import { addMessage, showToast } from './ui.js';

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
    addMessage(txt, true, new Date(), false, !isNewChat);

    document.getElementById('chat-input').value = '';
    document.getElementById('chat-input').style.height = 'auto';
    document.getElementById('chat-input').disabled = true;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('typing').style.display = 'flex';

    let aiMessageBubble;
    let fullResponse = '';
    let currentConversationId = app.conversationId;
    const wordQueue = [];
    let isRendering = false;
    let streamEnded = false;

    function renderWords() {
        if (wordQueue.length === 0) {
            isRendering = false;
            if (streamEnded) {
                finalizeMessage();
            }
            return;
        }
        isRendering = true;
        
        const word = wordQueue.shift();
        fullResponse += word;
        aiMessageBubble.querySelector('span').innerHTML = fullResponse.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        app.scrollToBottom();

        const delay = word.includes('\n') ? 150 : 80;
        setTimeout(renderWords, delay);
    }

    function finalizeMessage() {
        if (aiMessageBubble) {
            const c = document.createElement('span');
            c.className = 'copy-btn';
            c.innerHTML = '<i class="fas fa-copy"></i>';
            c.addEventListener('click', () => navigator.clipboard.writeText(fullResponse));
            aiMessageBubble.appendChild(c);

            const md = document.createElement('div');
            md.className = 'metadata';
            md.textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            aiMessageBubble.appendChild(md);
        }

        if (app.settings.saveHistory) {
            app.saveMessageToHistory(currentConversationId, txt, true, fullResponse);
        }
    }

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: txt, conversationId: currentConversationId })
        });

        if (!response.body) {
            throw new Error("Streaming not supported or response has no body.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let firstChunk = true;
        let tokenBuffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                streamEnded = true;
                if (tokenBuffer) {
                    wordQueue.push(tokenBuffer);
                    if (!isRendering) renderWords();
                }
                if (!isRendering) {
                     finalizeMessage();
                }
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataContent = line.substring(6);
                    if (dataContent === '[DONE]') {
                        continue;
                    }
                    
                    const data = JSON.parse(dataContent);

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
                        firstChunk = false;
                    }
                    
                    if (data.token) {
                        tokenBuffer += data.token;
                        const parts = tokenBuffer.split(/(\s+)/);
                        if (parts.length > 1) {
                            for (let i = 0; i < parts.length - 1; i++) {
                                wordQueue.push(parts[i]);
                            }
                            tokenBuffer = parts[parts.length - 1];
                            if (!isRendering) {
                                renderWords();
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
        addMessage('Fehler bei der Verbindung zum Server.', false, new Date());
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

    if (!feedbackText) {
        showToast("Bitte geben Sie Ihr Feedback ein.");
        return;
    }

    if (!captcha || parseInt(captcha, 10) !== app.expectedCaptcha) {
        showToast("Falsche Antwort auf die Sicherheitsfrage.");
        app.expectedCaptcha = app.generateCaptcha();
        return;
    }

    try {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedback_text: feedbackText,
                email: email,
                conversation_id: app.conversationId,
                captcha: captcha,
                expected_captcha: app.expectedCaptcha
            })
        });

        if (response.ok) {
            showToast("Vielen Dank für Ihr Feedback!");
            app.closeFeedback();
            document.getElementById('feedback-input').value = '';
            document.getElementById('feedback-email').value = '';
        } else {
            const errorData = await response.json();
            showToast(`Fehler: ${errorData.message || 'Feedback konnte nicht gesendet werden.'}`);
        }
    } catch (error) {
        console.error('Feedback submission error:', error);
        showToast("Ein Netzwerkfehler ist aufgetreten.");
    }
}