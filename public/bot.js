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
        useFirstAvatar = true;
        startWelcomeAnimation();
        
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

    async function sendMsg() {
        const txt = chatInput.value.trim();
        if (!txt) return;

        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const isNewChat = !conversationId;
        if (isNewChat) {
            conversationId = `chat_${Date.now()}`;
        }
        
        addMsg(txt, true, new Date());

        if (isNewChat && settings.saveHistory) {
            const history = getChatHistory();
            history.push({
                id: conversationId,
                title: txt.substring(0, 40) + (txt.length > 40 ? '...' : ''),
                messages: [{ text: txt, isUser: true, timestamp: new Date().toISOString() }]
            });
            saveChatHistory(history);
            renderChatHistory();
        }

        chatInput.value = '';
        chatInput.disabled = true;
        sendBtnEl.disabled = true;
        typingEl.style.display = 'flex';

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: txt, conversationId })
            });
            const data = await res.json();
            
            addMsg(data.response, false, new Date(), true, true);

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

    // --- Event Listeners ---
    sendBtnEl.addEventListener('click', sendMsg);
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
    
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

        const history = getChatHistory();
        if (history.length > 0) {
            loadChat(history[history.length - 1].id);
        } else {
            startNewChat();
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