document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const currentTimeEl = document.getElementById('current-time');
    const messagesEl = document.getElementById('messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtnEl = document.getElementById('send-btn');
    const typingEl = document.getElementById('typing');
    const scrollBtnEl = document.getElementById('scroll-btn');
    const historyContainer = document.getElementById('history-items-container');
    let conversationId = null;
    let currentMessages = [];

    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const closeSettings = document.getElementById("close-settings");
    const accentColorInput = document.getElementById("accent-color");

    const feedbackBtn = document.getElementById("feedback-btn");
    const feedbackModal = document.getElementById("feedback-modal");
    const closeFeedbackBtn = document.getElementById("close-feedback");
    const sendFeedbackBtn = document.getElementById("send-feedback");
    const feedbackInput = document.getElementById("feedback-input");
    const captchaQuestionEl = document.getElementById('captcha-question');
    const captchaInput = document.getElementById('captcha-input');
    let captchaAnswer = null;

    const botAvatarImage1 = '/image/smoky_klein.png';
    const botAvatarImage2 = '/image/stu_klein.png';
    let useFirstAvatar = true;

    const CHAT_HISTORY_KEY = 'htw-chat-history';

    // --- Chat History Management ---

    function getChatHistory() {
        try {
            const history = sessionStorage.getItem(CHAT_HISTORY_KEY);
            return history ? JSON.parse(history) : [];
        } catch (e) {
            console.error("Could not parse chat history:", e);
            return [];
        }
    }

    function saveChatHistory(history) {
        sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
    }

    function renderChatHistory() {
        const history = getChatHistory();
        historyContainer.innerHTML = '';
        history.forEach(chat => {
            const historyItem = document.createElement('a');
            historyItem.href = '#';
            historyItem.className = 'history-item';
            historyItem.textContent = chat.title;
            historyItem.setAttribute('data-id', chat.id);
            if (chat.id === conversationId) {
                historyItem.classList.add('active');
            }
            historyItem.addEventListener('click', (e) => {
                e.preventDefault();
                loadChat(chat.id);
            });
            historyContainer.appendChild(historyItem);
        });
    }

    function loadChat(id) {
        const history = getChatHistory();
        const chat = history.find(c => c.id === id);
        if (!chat) return;

        conversationId = chat.id;
        currentMessages = chat.messages;
        messagesEl.innerHTML = '';
        useFirstAvatar = true;

        chat.messages.forEach(msg => {
            if (msg.type === 'image') {
                addImageMessage(msg.src, false);
            } else {
                addMsg(msg.text, msg.isUser, msg.timestamp, !msg.isUser, false);
            }
        });
        
        document.querySelectorAll('.history-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-id') === id);
        });
    }

    function saveMessageToHistory(message) {
        const history = getChatHistory();
        const chat = history.find(c => c.id === conversationId);
        if (chat) {
            chat.messages.push(message);
            saveChatHistory(history);
        }
    }

    // Toast-Funktion
    function showToast(message) {
        const template = document.getElementById('toast-template');
        if (!template) return;
        const toast = template.content.cloneNode(true).firstElementChild;
        toast.querySelector('.toast-message').textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
        toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
    }

    // Uhrzeit aktualisieren
    function updateClock() {
        if (currentTimeEl) {
            currentTimeEl.textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        }
    }
    setInterval(updateClock, 1000);
    updateClock();

    const initialAccent = getComputedStyle(root).getPropertyValue('--accent-color').trim();
    accentColorInput.value = initialAccent;

    // Einstellungen-Modal & Akzentfarbe
    settingsBtn.addEventListener("click", () => settingsModal.classList.add("open"));
    closeSettings.addEventListener("click", () => settingsModal.classList.remove("open"));
    settingsModal.addEventListener("click", e => { if (e.target === settingsModal) settingsModal.classList.remove("open"); });
    accentColorInput.addEventListener("input", () => {
        document.documentElement.style.setProperty("--accent-color", accentColorInput.value);
        localStorage.setItem("accent-color", accentColorInput.value);
    });

    // Captcha generieren
    function generateCaptcha() {
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        captchaAnswer = num1 + num2;
        captchaQuestionEl.textContent = `${num1} + ${num2} = ?`;
        captchaInput.value = '';
    }

    // Feedback-Modal
    feedbackBtn.addEventListener("click", () => {
        feedbackModal.classList.add("open");
        generateCaptcha();
    });
    closeFeedbackBtn.addEventListener("click", () => feedbackModal.classList.remove("open"));
    feedbackModal.addEventListener("click", e => { if (e.target === feedbackModal) feedbackModal.classList.remove("open"); });
    sendFeedbackBtn.addEventListener("click", async () => {
        const feedbackText = feedbackInput.value.trim();
        const email = document.getElementById('feedback-email').value.trim();
        const userAnswer = captchaInput.value.trim();

        if (!feedbackText) {
            showToast("Bitte geben Sie Ihr Feedback ein.");
            return;
        }
        if (!userAnswer) {
            showToast("Bitte lösen Sie das Captcha.");
            return;
        }

        sendFeedbackBtn.disabled = true;
        sendFeedbackBtn.textContent = 'Senden...';

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feedback_text: feedbackText,
                    email: email,
                    conversation_id: conversationId,
                    captcha: userAnswer,
                    expected_captcha: captchaAnswer
                })
            });

            if (response.ok) {
                showToast("Vielen Dank für Ihr Feedback!");
                feedbackInput.value = '';
                document.getElementById('feedback-email').value = '';
                captchaInput.value = '';
                feedbackModal.classList.remove("open");
            } else {
                const errorData = await response.json().catch(() => ({ message: 'Unbekannter Fehler' }));
                showToast(`Fehler: ${errorData.message || 'Beim Senden ist ein Problem aufgetreten.'}`);
                generateCaptcha();
            }
        } catch (error) {
            console.error("Feedback error:", error);
            showToast("Ein Netzwerkfehler ist aufgetreten. Bitte prüfen Sie Ihre Verbindung.");
            generateCaptcha();
        } finally {
            sendFeedbackBtn.disabled = false;
            sendFeedbackBtn.textContent = 'Senden';
        }
    });

    // Scroll-Logik
    function scrollToBottom() {
        scrollBtnEl.style.display = 'none';
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    messagesEl.addEventListener('scroll', () => {
        const distance = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
        scrollBtnEl.style.display = distance > 100 ? 'block' : 'none';
    });
    scrollBtnEl.addEventListener('click', scrollToBottom);

    // Auto-Resize für Input-Feld
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = `${chatInput.scrollHeight}px`;
    });

    // Nachricht zum Chat hinzufügen
    function addMsg(text, isUser, timestamp, copyable = false, save = true) {
        const m = document.createElement('div');
        m.className = `message ${isUser ? 'user' : 'ai'}`;

        const avatar = document.createElement('div');
        avatar.className = 'avatar';

        if (isUser) {
            avatar.innerHTML = `<i class="fas fa-user"></i>`;
        } else {
            const avatarSrc = useFirstAvatar ? botAvatarImage1 : botAvatarImage2;
            avatar.innerHTML = `<img src="${avatarSrc}" alt="Bot Avatar" />`;
            useFirstAvatar = !useFirstAvatar;
        }
        m.appendChild(avatar);

        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\n/g, '<br>');
        formattedText = formattedText.replace(/📋/g, '');

        bubble.innerHTML = formattedText;

        if (!isUser && copyable) {
            const c = document.createElement('span');
            c.className = 'copy-btn';
            c.innerHTML = '<i class="fas fa-copy"></i>';
            c.addEventListener('click', () => navigator.clipboard.writeText(text));
            bubble.appendChild(c);
        }

        const md = document.createElement('div');
        md.className = 'metadata';
        md.textContent = new Date(timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        bubble.appendChild(md);

        m.appendChild(bubble);
        messagesEl.appendChild(m);
        scrollToBottom();

        if (save) {
            saveMessageToHistory({ text, isUser, timestamp: timestamp.toISOString(), type: 'text' });
        }
    }

    function addImageMessage(src, save = true) {
        const m = document.createElement('div');
        m.className = 'message ai';

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        const avatarSrc = useFirstAvatar ? botAvatarImage1 : botAvatarImage2;
        avatar.innerHTML = `<img src="${avatarSrc}" alt="Bot Avatar" />`;
        useFirstAvatar = !useFirstAvatar;
        m.appendChild(avatar);

        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-bubble';
        imageContainer.innerHTML = `<img src="${src}" alt="Lageplan" />`;
        m.appendChild(imageContainer);

        messagesEl.appendChild(m);
        scrollToBottom();

        if (save) {
            saveMessageToHistory({ src, type: 'image', isUser: false, timestamp: new Date().toISOString() });
        }
    }

    // Neuer Chat
    document.getElementById('new-chat').addEventListener('click', () => {
        messagesEl.innerHTML = '';
        conversationId = null;
        currentMessages = [];
        useFirstAvatar = true;
        addMsg('Neues Gespräch gestartet. Wie kann ich helfen?', false, new Date(), false, false);
        renderChatHistory(); // Update active state
    });

    // Nachricht senden
    async function sendMsg(prefilled) {
        const txt = prefilled || chatInput.value.trim();
        if (!txt) return;

        const isNewChat = !conversationId;
        addMsg(txt, true, new Date());

        const locationKeywords = ['lageplan', 'wo ist', 'gebäude', 'campusplan', 'karte von', 'finde ich'];
        const isLocationQuery = locationKeywords.some(keyword => txt.toLowerCase().includes(keyword));

        chatInput.value = '';
        chatInput.style.height = 'auto';
        chatInput.disabled = true;
        sendBtnEl.disabled = true;
        typingEl.style.display = 'flex';
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: txt,
                    conversationId
                })
            });
            const data = await res.json();
            
            if (isNewChat) {
                conversationId = data.conversationId;
                const history = getChatHistory();
                history.push({
                    id: conversationId,
                    title: txt.substring(0, 40) + (txt.length > 40 ? '...' : ''),
                    messages: currentMessages
                });
                saveChatHistory(history);
                renderChatHistory();
            }
            
            addMsg(data.response, false, new Date(), true);

            if (isLocationQuery) {
                addImageMessage('/image/lageplan.png');
            }

        } catch (e) {
            addMsg('Fehler bei der Verbindung zum Server.', false, new Date());
            console.error(e);
        } finally {
            typingEl.style.display = 'none';
            chatInput.disabled = false;
            sendBtnEl.disabled = false;
            chatInput.focus();
        }
    }

    // Event Listeners
    sendBtnEl.addEventListener('click', () => sendMsg());
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMsg();
        }
    });

    // Initialisierung
    function init() {
        renderChatHistory();
        const history = getChatHistory();
        if (history.length > 0) {
            loadChat(history[history.length - 1].id); // Load the last chat
        } else {
            addMsg('Hallo! Ich bin Alex, dein AI-Assistent der HTW Dresden. Wie kann ich dir helfen?', false, new Date(), false, false);
        }
    }

    init();
});