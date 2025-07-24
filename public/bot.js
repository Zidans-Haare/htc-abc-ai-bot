document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const root = document.documentElement;
    const messagesEl = document.getElementById('messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtnEl = document.getElementById('send-btn');
    const typingEl = document.getElementById('typing');
    const historyContainer = document.getElementById('history-items-container');
    
    // --- Modals & Buttons ---
    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const closeSettingsBtn = document.getElementById("close-settings");
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    
    const feedbackBtn = document.getElementById("feedback-btn");
    const feedbackModal = document.getElementById("feedback-modal");
    const closeFeedbackBtn = document.getElementById("close-feedback");
    const sendFeedbackBtn = document.getElementById('send-feedback');
    const feedbackLanguageSelect = document.getElementById('feedback-language-select');
    
    const newChatBtn = document.getElementById('new-chat');
    const deleteAllChatsBtn = document.getElementById('delete-all-chats-btn');

    // --- Mobile Menu Elements ---
    const hamburgerBtn = document.getElementById('hamburger-menu');
    const mobileMenu = document.getElementById('mobile-menu');
    const closeMobileMenuBtn = document.getElementById('close-mobile-menu');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    const mobileNewChatBtn = document.getElementById('mobile-new-chat');
    const mobileSettingsBtn = document.getElementById('mobile-settings-btn');
    const mobileFeedbackBtn = document.getElementById('mobile-feedback-btn');
    const mobileHistoryContainer = document.getElementById('mobile-history-items-container');

    // --- Global State ---
    let conversationId = null;
    let expectedCaptcha;
    const botAvatarImage1 = '/image/smoky_klein.png';
    const botAvatarImage2 = '/image/stu_klein.png';
    let useFirstAvatar = true;
    const CHAT_HISTORY_KEY = 'htw-chat-history';
    const SETTINGS_KEY = 'htw-chat-settings';

    // --- Default Settings ---
    const defaultSettings = {
        uiLanguage: 'de',
        theme: 'system',
        accentColor: '#EC6608',
        fontSize: 'medium',
        layoutDensity: 'standard',
        animationSpeed: 'normal',
        homeScreenIcon: 'image/smoky_klein.png',
        saveHistory: true,
        autoDelete: '0',
        tts: false,
        contrastMode: false,
        keyboardNav: false,
    };

    let settings = { ...defaultSettings };
    let tempSettings = { ...defaultSettings };

    // --- Translations ---
    const i18n = {
        de: {
            settings_title: "Einstellungen",
            settings_ui_language: "Sprache der Einstellungen",
            section_design_title: "Design & Darstellung",
            setting_theme: "Design-Modus",
            theme_system: "System",
            theme_light: "Hell",
            theme_dark: "Dunkel",
            setting_accent_color: "Akzentfarbe",
            setting_font_size: "Schriftgröße",
            font_size_small: "Klein",
            font_size_medium: "Mittel",
            font_size_large: "Groß",
            setting_layout_density: "Layoutdichte",
            layout_density_compact: "Kompakt",
            layout_density_standard: "Standard",
            layout_density_spacious: "Großzügig",
            setting_animation_speed: "Animationsdauer",
            animation_speed_normal: "Normal",
            animation_speed_reduced: "Reduziert",
            animation_speed_none: "Keine",
            setting_home_screen_icon: "Home-Bildschirm-Icon",
            section_accessibility_title: "Barrierefreiheit",
            setting_tts: "Vorlesefunktion aktivieren",
            setting_contrast_mode: "Kontrastmodus aktivieren",
            setting_keyboard_nav: "Tastaturnavigation verbessern",
            section_privacy_title: "Datenschutz & Daten",
            setting_save_history: "Verlauf speichern",
            setting_auto_delete: "Automatisches Löschen nach",
            auto_delete_never: "Nie",
            auto_delete_1_day: "1 Tag",
            auto_delete_7_days: "7 Tagen",
            auto_delete_30_days: "30 Tagen",
            delete_all_chats_label: "Alle Chats löschen",
            delete_all_chats_button: "Jetzt löschen",
            reset_settings_button: "Auf Standard zurücksetzen",
            save_settings_button: "Speichern & Anwenden",
        },
        en: {
            settings_title: "Settings",
            settings_ui_language: "Settings Language",
            section_design_title: "Design & Appearance",
            setting_theme: "Theme Mode",
            theme_system: "System",
            theme_light: "Light",
            theme_dark: "Dark",
            setting_accent_color: "Accent Color",
            setting_font_size: "Font Size",
            font_size_small: "Small",
            font_size_medium: "Medium",
            font_size_large: "Large",
            setting_layout_density: "Layout Density",
            layout_density_compact: "Compact",
            layout_density_standard: "Standard",
            layout_density_spacious: "Spacious",
            setting_animation_speed: "Animation Speed",
            animation_speed_normal: "Normal",
            animation_speed_reduced: "Reduced",
            animation_speed_none: "None",
            setting_home_screen_icon: "Home Screen Icon",
            section_accessibility_title: "Accessibility",
            setting_tts: "Enable Text-to-Speech",
            setting_contrast_mode: "Enable High Contrast Mode",
            setting_keyboard_nav: "Improve Keyboard Navigation",
            section_privacy_title: "Privacy & Data",
            setting_save_history: "Save History",
            setting_auto_delete: "Auto-delete after",
            auto_delete_never: "Never",
            auto_delete_1_day: "1 day",
            auto_delete_7_days: "7 days",
            auto_delete_30_days: "30 days",
            delete_all_chats_label: "Delete All Chats",
            delete_all_chats_button: "Delete Now",
            reset_settings_button: "Reset to Default",
            save_settings_button: "Save & Apply",
        }
    };

    const i18n_feedback = {
        de: {
            feedback_title: "Feedback geben",
            feedback_language: "Sprache des Formulars",
            feedback_description: "Ist Ihnen ein Fehler aufgefallen oder haben Sie einen Verbesserungsvorschlag? Wir freuen uns über Ihre Rückmeldung!",
            feedback_message: "Ihre Nachricht",
            feedback_message_placeholder: "Beschreiben Sie hier Ihr Anliegen...",
            feedback_email: "E-Mail (optional)",
            feedback_captcha: "Sicherheitsfrage",
            feedback_captcha_placeholder: "Antwort",
            feedback_send: "Senden",
        },
        en: {
            feedback_title: "Give Feedback",
            feedback_language: "Form Language",
            feedback_description: "Have you noticed an error or do you have a suggestion for improvement? We look forward to your feedback!",
            feedback_message: "Your Message",
            feedback_message_placeholder: "Describe your issue here...",
            feedback_email: "Email (optional)",
            feedback_captcha: "Security Question",
            feedback_captcha_placeholder: "Answer",
            feedback_send: "Send",
        }
    };

    // --- Settings Management ---
    function saveSettings() {
        settings = { ...tempSettings };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        applySettings();
        showToast("Einstellungen gespeichert und angewendet!");
        settingsModal.classList.remove('open');
    }

    function loadSettings() {
        try {
            const storedSettings = localStorage.getItem(SETTINGS_KEY);
            if (storedSettings) {
                settings = { ...defaultSettings, ...JSON.parse(storedSettings) };
            }
            tempSettings = { ...settings };
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
        applySettings();
        updateSettingsUI();
    }
    
    function applySettings() {
        // Language
        setSettingsLanguage(settings.uiLanguage);

        // Theme
        const isDarkMode = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        root.classList.toggle('dark-mode', isDarkMode);
        
        // Accent Color
        root.style.setProperty('--accent-color', settings.accentColor);
        
        // Font Size
        const fontSizes = { small: '14px', medium: '16px', large: '18px' };
        root.style.setProperty('--font-size', fontSizes[settings.fontSize] || '16px');
        
        // Layout Density
        const densities = { compact: '0.8', standard: '1', spacious: '1.2' };
        root.style.setProperty('--layout-density-multiplier', densities[settings.layoutDensity] || '1');
        
        // Animation Speed
        const speeds = { normal: '1', reduced: '0.5', none: '0' };
        root.style.setProperty('--animation-speed-multiplier', speeds[settings.animationSpeed] || '1');
        
        // Contrast Mode
        root.classList.toggle('contrast-mode', settings.contrastMode);

        // Keyboard Navigation
        root.classList.toggle('keyboard-nav-active', settings.keyboardNav);

        // Home Screen Icon
        const touchIcons = document.querySelectorAll('link[rel="apple-touch-icon"]');
        touchIcons.forEach(icon => {
            const sizes = icon.getAttribute('sizes');
            if (sizes) {
                icon.href = settings.homeScreenIcon.replace('.png', `_${sizes}.png`);
            } else {
                icon.href = settings.homeScreenIcon;
            }
        });
    }

    function updateSettingsUI() {
        Object.keys(tempSettings).forEach(key => {
            const elId = `setting-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
            const el = document.getElementById(elId);
            if (!el) return;
    
            if (el.type === 'checkbox') {
                el.checked = tempSettings[key];
            } else if (el.classList.contains('image-picker')) {
                const selectedRadio = el.querySelector(`input[value="${tempSettings[key]}"]`);
                if (selectedRadio) {
                    selectedRadio.checked = true;
                }
            } else {
                el.value = tempSettings[key];
            }
        });
        document.getElementById('accent-color').value = tempSettings.accentColor;
    }
    
    function handleSettingChange(e) {
        const { id, value, type, checked, name } = e.target;
        let key = id.replace('setting-', '').replace(/-/g, '');
        if (id === 'accent-color') key = 'accentColor';
        if (name === 'home-icon') key = 'homeScreenIcon';
        
        let finalValue = type === 'checkbox' ? checked : value;
        
        const keyMap = {
            uilanguage: 'uiLanguage',
            theme: 'theme',
            accentColor: 'accentColor',
            fontsize: 'fontSize',
            layoutdensity: 'layoutDensity',
            animationspeed: 'animationSpeed',
            homescreenicon: 'homeScreenIcon',
            savehistory: 'saveHistory',
            autodelete: 'autoDelete',
            tts: 'tts',
            contrastmode: 'contrastMode',
            keyboardnav: 'keyboardNav',
        };
        
        const settingKey = keyMap[key.toLowerCase()];
        if (settingKey) {
            tempSettings[settingKey] = finalValue;
            if (settingKey === 'uiLanguage') {
                setSettingsLanguage(finalValue);
            }
        }
    }

    function resetSettings() {
        if (confirm("Möchten Sie wirklich alle Einstellungen auf die Standardwerte zurücksetzen?")) {
            tempSettings = { ...defaultSettings };
            saveSettings();
            updateSettingsUI();
        }
    }

    function setSettingsLanguage(lang) {
        const translations = i18n[lang] || i18n.de;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[key]) {
                el.textContent = translations[key];
            }
        });
    }

    function setFeedbackLanguage(lang) {
        const translations = i18n_feedback[lang] || i18n_feedback.de;
        document.querySelectorAll('#feedback-modal [data-lang-key]').forEach(el => {
            const key = el.getAttribute('data-lang-key');
            if (translations[key]) {
                el.textContent = translations[key];
            }
        });
        document.querySelectorAll('#feedback-modal [data-lang-placeholder]').forEach(el => {
            const key = el.getAttribute('data-lang-placeholder');
            if (translations[key]) {
                el.placeholder = translations[key];
            }
        });
    }

    // --- Chat History Management ---
    function getChatHistory() {
        if (!settings.saveHistory) return [];
        try {
            const history = localStorage.getItem(CHAT_HISTORY_KEY);
            return history ? JSON.parse(history) : [];
        } catch (e) {
            console.error("Could not parse chat history:", e);
            return [];
        }
    }

    function saveChatHistory(history) {
        if (settings.saveHistory) {
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
        }
    }
    
    function deleteAllChats() {
        if (confirm("Möchten Sie wirklich alle Chatverläufe unwiderruflich löschen?")) {
            localStorage.removeItem(CHAT_HISTORY_KEY);
            renderChatHistory();
            document.getElementById('new-chat').click();
            showToast("Alle Verläufe wurden gelöscht.");
        }
    }

    function autoDeleteOldChats() {
        if (settings.autoDelete === '0' || !settings.saveHistory) return;
        const days = parseInt(settings.autoDelete, 10);
        const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
        let history = getChatHistory();
        const filteredHistory = history.filter(chat => {
            const lastMessage = chat.messages[chat.messages.length - 1];
            return new Date(lastMessage.timestamp).getTime() > threshold;
        });
        if (history.length !== filteredHistory.length) {
            saveChatHistory(filteredHistory);
            renderChatHistory();
        }
    }

    function startNewChat() {
        conversationId = null;
        messagesEl.innerHTML = `
            <div id="welcome-message">
                <div class="message ai">
                    <div class="avatar">
                        <img src="/image/smoky_klein.png" alt="Bot Avatar">
                    </div>
                    <div class="bubble">
                        <span>Hallo! Ich bin Alex, dein AI-Assistent der HTW Dresden. Wie kann ich dir helfen?</span>
                    </div>
                </div>
            </div>`;
        const suggestions = document.getElementById('prompt-suggestions');
        if (suggestions) {
            suggestions.style.display = 'flex';
        }
        useFirstAvatar = true;
        startWelcomeAnimation();
        setupSuggestionListeners();
        
        // De-select any active history item
        document.querySelectorAll('.history-item.active').forEach(item => item.classList.remove('active'));
    }

    function renderChatHistory() {
        const history = getChatHistory();
        const containers = [historyContainer, mobileHistoryContainer];
        
        containers.forEach(container => {
            if (!container) return;
            container.innerHTML = '';
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
                    closeMobileMenu(); // Close menu on chat selection
                });
                container.appendChild(historyItem);
            });
        });
    }

    function loadChat(id) {
        const history = getChatHistory();
        const chat = history.find(c => c.id === id);
        if (!chat) return;

        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        conversationId = chat.id;
        messagesEl.innerHTML = '';
        useFirstAvatar = true;

        chat.messages.forEach(msg => {
            addMsg(msg.text, msg.isUser, new Date(msg.timestamp), !msg.isUser, false);
        });
        
        document.querySelectorAll('.history-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-id') === id);
        });
    }

    // --- UI Functions ---
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

    function scrollToBottom() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function updateTime() {
        const timeEl = document.getElementById('current-time');
        if (timeEl) {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        }
    }

    // --- Chat Messaging ---
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
        
        bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

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

        if (!isUser && settings.tts) {
            speak(text);
        }

        if (save && settings.saveHistory) {
            const history = getChatHistory();
            const chat = history.find(c => c.id === conversationId);
            if (chat) {
                chat.messages.push({ text, isUser, timestamp: timestamp.toISOString() });
                saveChatHistory(history);
            }
        }
    }

    async function sendMsg(promptText) {
        const txt = typeof promptText === 'string' ? promptText : chatInput.value.trim();
        if (!txt) return;

        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        const suggestions = document.getElementById('prompt-suggestions');
        if (suggestions) {
            suggestions.style.display = 'none';
        }

        const isNewChat = !conversationId;
        addMsg(txt, true, new Date(), false, !isNewChat); // Save user message immediately only if it's not a new chat

        chatInput.value = '';
        chatInput.style.height = 'auto';
        chatInput.disabled = true;
        sendBtnEl.disabled = true;
        typingEl.style.display = 'flex';

        let aiMessageBubble;
        let fullResponse = '';
        let currentConversationId = conversationId;
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
            scrollToBottom();

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

            if (settings.saveHistory) {
                const history = getChatHistory();
                let chat = history.find(c => c.id === currentConversationId);
                if (isNewChat) {
                    history.push({
                        id: currentConversationId,
                        title: txt.substring(0, 40) + (txt.length > 40 ? '...' : ''),
                        messages: [
                            { text: txt, isUser: true, timestamp: new Date().toISOString() },
                            { text: fullResponse, isUser: false, timestamp: new Date().toISOString() }
                        ]
                    });
                    renderChatHistory();
                } else if (chat) {
                    const lastMessage = chat.messages[chat.messages.length - 1];
                    if (lastMessage && !lastMessage.isUser) {
                        lastMessage.text = fullResponse;
                    } else {
                         chat.messages.push({ text: fullResponse, isUser: false, timestamp: new Date().toISOString() });
                    }
                }
                saveChatHistory(history);
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
                            typingEl.style.display = 'none';
                            currentConversationId = data.conversationId;
                            if (isNewChat) {
                                conversationId = currentConversationId;
                            }
                            
                            const m = document.createElement('div');
                            m.className = 'message ai';
                            const avatar = document.createElement('div');
                            avatar.className = 'avatar';
                            const avatarSrc = useFirstAvatar ? botAvatarImage1 : botAvatarImage2;
                            avatar.innerHTML = `<img src="${avatarSrc}" alt="Bot Avatar" />`;
                            useFirstAvatar = !useFirstAvatar;
                            m.appendChild(avatar);

                            aiMessageBubble = document.createElement('div');
                            aiMessageBubble.className = 'bubble';
                            aiMessageBubble.innerHTML = '<span></span>';
                            m.appendChild(aiMessageBubble);
                            messagesEl.appendChild(m);
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
            addMsg('Fehler bei der Verbindung zum Server.', false, new Date());
        } finally {
            typingEl.style.display = 'none';
            chatInput.disabled = false;
            sendBtnEl.disabled = false;
            chatInput.focus();
        }
    }

    // --- Accessibility ---
    function speak(text) {
        if ('speechSynthesis' in window && settings.tts) {
            const utterance = new SpeechSynthesisUtterance(text.replace(/\*\*/g, '')); // Clean markdown for TTS
            utterance.lang = 'de-DE';
            window.speechSynthesis.speak(utterance);
        }
    }

    // --- Feedback Submission ---
    function generateCaptcha() {
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        expectedCaptcha = num1 + num2;
        document.getElementById('captcha-question').textContent = `${num1} + ${num2} = ?`;
        document.getElementById('captcha-input').value = '';
    }

    async function sendFeedback() {
        const feedbackText = document.getElementById('feedback-input').value.trim();
        const email = document.getElementById('feedback-email').value.trim();
        const captcha = document.getElementById('captcha-input').value;

        if (!feedbackText) {
            showToast("Bitte geben Sie Ihr Feedback ein.");
            return;
        }

        if (!captcha || parseInt(captcha, 10) !== expectedCaptcha) {
            showToast("Falsche Antwort auf die Sicherheitsfrage.");
            generateCaptcha(); // Generate a new question
            return;
        }

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feedback_text: feedbackText,
                    email: email,
                    conversation_id: conversationId,
                    captcha: captcha,
                    expected_captcha: expectedCaptcha
                })
            });

            if (response.ok) {
                showToast("Vielen Dank für Ihr Feedback!");
                feedbackModal.classList.remove('open');
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

    // --- Mobile Menu Functions ---
    function openMobileMenu() {
        if (mobileMenu && mobileMenuOverlay) {
            mobileMenu.classList.add('open');
            mobileMenuOverlay.classList.add('open');
        }
    }

    function closeMobileMenu() {
        if (mobileMenu && mobileMenuOverlay) {
            mobileMenu.classList.remove('open');
            mobileMenuOverlay.classList.remove('open');
        }
    }

    // --- Keyboard Handling for Mobile ---
    function handleKeyboard() {
        const appContainer = document.querySelector('.app-container');
        if (!appContainer) return;

        // Use a more reliable check for mobile devices
        const isMobile = window.matchMedia("(max-width: 768px)").matches;

        if (isMobile) {
            let initialHeight = window.innerHeight;

            chatInput.addEventListener('focus', () => {
                // Set a fixed height to prevent the whole page from shrinking
                appContainer.style.height = `${initialHeight}px`;
                // Scroll to the bottom to keep the input in view
                setTimeout(() => {
                    scrollToBottom();
                    chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 300); // Delay to allow keyboard to appear
            });

            chatInput.addEventListener('blur', () => {
                // Restore dynamic height when keyboard is dismissed
                appContainer.style.height = '100%';
            });

            window.addEventListener('resize', () => {
                // Update initial height if the window is resized for reasons other than the keyboard
                if (window.innerHeight < initialHeight - 150) { // Keyboard is likely open
                    // Do nothing, keep the fixed height
                } else {
                    initialHeight = window.innerHeight;
                    if (document.activeElement !== chatInput) {
                         appContainer.style.height = '100%';
                    }
                }
            });
        }
    }

    // --- Event Listeners ---
    sendBtnEl.addEventListener('click', sendMsg);
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
    
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = `${chatInput.scrollHeight}px`;
    });

    settingsBtn.addEventListener("click", () => { 
        tempSettings = {...settings}; 
        updateSettingsUI(); 
        settingsModal.classList.add("open"); 
    });
    
    closeSettingsBtn.addEventListener("click", () => settingsModal.classList.remove("open"));
    saveSettingsBtn.addEventListener('click', saveSettings);
    resetSettingsBtn.addEventListener('click', resetSettings);
    
    newChatBtn.addEventListener('click', startNewChat);
    deleteAllChatsBtn.addEventListener('click', deleteAllChats);
    
    feedbackBtn.addEventListener("click", () => {
        feedbackModal.classList.add("open");
        setFeedbackLanguage(feedbackLanguageSelect.value);
        generateCaptcha();
    });
    closeFeedbackBtn.addEventListener("click", () => feedbackModal.classList.remove("open"));
    sendFeedbackBtn.addEventListener('click', sendFeedback);
    feedbackLanguageSelect.addEventListener('change', (e) => setFeedbackLanguage(e.target.value));
    
    // --- Mobile Menu Listeners ---
    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openMobileMenu);
    if (closeMobileMenuBtn) closeMobileMenuBtn.addEventListener('click', closeMobileMenu);
    if (mobileMenuOverlay) mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    
    if (mobileNewChatBtn) {
        mobileNewChatBtn.addEventListener('click', () => {
            startNewChat();
            closeMobileMenu();
        });
    }
    if (mobileSettingsBtn) {
        mobileSettingsBtn.addEventListener('click', () => {
            settingsBtn.click(); // Trigger original settings button
            closeMobileMenu();
        });
    }
    if (mobileFeedbackBtn) {
        mobileFeedbackBtn.addEventListener('click', () => {
            feedbackBtn.click(); // Trigger original feedback button
            closeMobileMenu();
        });
    }

    document.querySelector('#settings-modal .modal-body').addEventListener('input', handleSettingChange);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (settings.theme === 'system') {
            applySettings();
        }
    });

    // --- Initialization ---
    function init() {
        loadSettings();
        autoDeleteOldChats();
        renderChatHistory();
        
        updateTime();
        setInterval(updateTime, 1000 * 60); // Update every minute

        startNewChat();
        handleKeyboard();
    }

    function setupSuggestionListeners() {
        const suggestions = document.getElementById('prompt-suggestions');
        if (suggestions) {
            suggestions.addEventListener('click', (e) => {
                const card = e.target.closest('.suggestion-card');
                if (card) {
                    const promptText = card.querySelector('p').textContent;
                    sendMsg(promptText);
                }
            });
        }
    }

    let welcomeInterval;
    function startWelcomeAnimation() {
        const welcomeBubble = document.querySelector('#welcome-message .bubble');
        const welcomeText = document.querySelector('#welcome-message .bubble span');
        if (!welcomeBubble || !welcomeText) return;

        const messages = [
            "Hallo! Ich bin Alex, dein AI-Assistent der HTW Dresden.",
            "Hello! I am Alex, your AI assistant from HTW Dresden.",
            "你好！我是 Alex，你来自德累斯顿应用技术大学的 AI 助手。"
        ];

        let messageIndex = 0;
        
        const updateMessage = () => {
            welcomeBubble.classList.remove('show');
            setTimeout(() => {
                messageIndex = (messageIndex + 1) % messages.length;
                welcomeText.textContent = messages[messageIndex];
                welcomeBubble.classList.add('show');
            }, 500); // Time for fade out
        };

        welcomeText.textContent = messages[messageIndex];
        welcomeBubble.classList.add('show');

        if (welcomeInterval) clearInterval(welcomeInterval);
        welcomeInterval = setInterval(updateMessage, 4000);
    }

    function stopWelcomeAnimation() {
        if (welcomeInterval) {
            clearInterval(welcomeInterval);
            welcomeInterval = null;
        }
    }

    init();
});