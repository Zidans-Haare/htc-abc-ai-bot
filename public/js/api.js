import { addMessage, showToast } from './ui.js';
import { renderMarkup } from './markup.js';
import { getChatById } from './history.js';
import { processImagesInBubble } from './imageLightbox.js';

export async function sendMsg(app, promptText) {
    const txt = typeof promptText === 'string' ? promptText : document.getElementById('chat-input').value.trim();
    if (!txt) return;

    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    const suggestions = document.getElementById('prompt-suggestions');
    if (suggestions) {
        suggestions.style.display = 'none';
    }

    const isNewChat = !app.conversationId;
    // Display the user's message immediately in the UI.
    addMessage(txt, true, new Date());

    document.getElementById('chat-input').value = '';
    document.getElementById('chat-input').style.height = 'auto';
    document.getElementById('chat-input').disabled = true;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('typing').style.display = 'flex';

    let aiMessageBubble;
    let fullResponse = '';
    let currentConversationId = app.conversationId;
    let tokensInfo = null;

    function finalizeMessage() {
        if (aiMessageBubble) {
            const c = document.createElement('span');
            c.className = 'copy-btn';
            c.innerHTML = '<i class="fas fa-copy"></i>';
            c.addEventListener('click', () => navigator.clipboard.writeText(fullResponse));
            aiMessageBubble.appendChild(c);

            const md = document.createElement('div');
            md.className = 'metadata';
            let metadataText = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            if (tokensInfo) {
                metadataText += ` | Sent: ${tokensInfo.sent} Tokens | Received: ${tokensInfo.received} Tokens`;
            }
            md.textContent = metadataText;
            aiMessageBubble.appendChild(md);
        }

        if (app.settings.saveHistory) {
            // Save both user and AI message at the end of the stream
            app.saveMessageToHistory(currentConversationId, txt, true, fullResponse);
        }
    }

    try {
        const headers = { 'Content-Type': 'application/json' };
        const userApiKey = localStorage.getItem('user_api_key');
        if (userApiKey) {
            headers['X-User-API-Key'] = userApiKey;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ 
                prompt: txt, 
                conversationId: currentConversationId,
                anonymousUserId: app.anonymousUserId, // Add this line
                timezoneOffset: new Date().getTimezoneOffset() 
            })
        });

        if (!response.body) {
            throw new Error("Streaming not supported or response has no body.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let firstChunk = true;
        let buffer = '';

        const processEvent = (eventString) => {
            const trimmedEvent = eventString.trim();
            if (!trimmedEvent) return;

            const lines = trimmedEvent.split('\n');

            for (const line of lines) {
                if (!line.startsWith('data: ')) {
                    continue;
                }

                const dataContent = line.substring(6);
                if (dataContent === '[DONE]') {
                    continue;
                }

                let data;
                try {
                    data = JSON.parse(dataContent);
                } catch (err) {
                    console.error('Failed to parse SSE data chunk:', err, dataContent);
                    continue;
                }

                if (firstChunk) {
                    document.getElementById('typing').style.display = 'none';
                    currentConversationId = data.conversationId;
                    if (isNewChat) {
                        app.conversationId = currentConversationId;
                    }

                    const m = document.createElement('div');
                    m.className = 'message ai';
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    const avatarSrc = app.useFirstAvatar ? '/image/smoky_klein.png' : '/image/stu_klein.png';
                    avatar.innerHTML = `<img src="${avatarSrc}" alt="Bot Avatar" />`;
                    app.useFirstAvatar = !app.useFirstAvatar;
                    m.appendChild(avatar);

                    aiMessageBubble = document.createElement('div');
                    aiMessageBubble.className = 'bubble';
                    aiMessageBubble.innerHTML = '<span></span>';
                    m.appendChild(aiMessageBubble);
                    document.getElementById('messages').appendChild(m);

                    // Post-process images (resize images to be max the width of the prompt bubble)
                    processImagesInBubble(aiMessageBubble);

                    firstChunk = false;
                }

                if (data.token) {
                    fullResponse += data.token;
                    aiMessageBubble.querySelector('span').innerHTML = renderMarkup(fullResponse);
                    app.scrollToBottom();
                }

                if (data.tokens) {
                    tokensInfo = data.tokens;
                }
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (buffer.trim() !== '') {
                    processEvent(buffer);
                    buffer = '';
                }
                finalizeMessage();
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';

            for (const event of events) {
                processEvent(event);
            }
        }
    } catch (e) {
        console.error(e);
        if (fullResponse) {
            finalizeMessage();
            showToast('Fehler bei der Verbindung zum Server.');
        } else {
            addMessage('Fehler bei der Verbindung zum Server.', false, new Date());
        }
    } finally {
        document.getElementById('typing').style.display = 'none';
        document.getElementById('chat-input').disabled = false;
        document.getElementById('send-btn').disabled = false;
        document.getElementById('chat-input').focus();
    }
}

export async function sendFeedback(app) {
    const feedbackText = document.getElementById('feedback-input').value.trim();
    const email = document.getElementById('feedback-email').value.trim();
    const captcha = document.getElementById('captcha-input').value;
    const historySelect = document.getElementById('feedback-chat-history');
    const selectedHistoryId = historySelect.value;

    if (!feedbackText) {
        showToast("Bitte geben Sie Ihr Feedback ein.");
        return;
    }

    if (!captcha || parseInt(captcha, 10) !== app.expectedCaptcha) {
        showToast("Falsche Antwort auf die Sicherheitsfrage.");
        app.expectedCaptcha = app.generateCaptcha();
        return;
    }

    let attachedChatHistory = null;
    if (selectedHistoryId) {
        const chat = getChatById(selectedHistoryId);
        if (chat && chat.messages) {
            attachedChatHistory = chat.messages.map(msg => {
                const prefix = msg.isUser ? 'User' : 'Assistant';
                return `${prefix}: ${msg.text}`;
            }).join('\n\n');
        }
    }

    try {
        const payload = {
            feedback_text: feedbackText,
            email: email,
            conversation_id: app.conversationId,
            captcha: captcha,
            expected_captcha: app.expectedCaptcha,
            attached_chat_history: attachedChatHistory
        };

        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast("Vielen Dank für Ihr Feedback!");
            app.closeFeedback();
            document.getElementById('feedback-input').value = '';
            document.getElementById('feedback-email').value = '';
            historySelect.value = '';
        } else {
            const errorData = await response.json();
            showToast(`Fehler: ${errorData.message || 'Feedback konnte nicht gesendet werden.'}`);
        }
    } catch (error) {
        console.error('Feedback submission error:', error);
        showToast("Ein Netzwerkfehler ist aufgetreten.");
    }
}
