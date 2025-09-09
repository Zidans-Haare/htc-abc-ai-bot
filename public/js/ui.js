import { i18n, i18n_feedback } from './config.js';
import { renderMarkup } from './markup.js';
import { getChatHistory, exportHistory, importHistory } from './history.js';
import { processImagesInBubble } from './imageLightbox.js';
import { getSettings } from './settings.js';

// --- DOM Element References ---
const messagesEl = document.getElementById('messages');
const chatInput = document.getElementById('chat-input');
const sendBtnEl = document.getElementById('send-btn');
const typingEl = document.getElementById('typing');
const historyContainer = document.getElementById('history-items-container');
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
const hamburgerBtn = document.getElementById('hamburger-menu');
const mobileMenu = document.getElementById('mobile-menu');
const closeMobileMenuBtn = document.getElementById('close-mobile-menu');
const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
const mobileNewChatBtn = document.getElementById('mobile-new-chat');
const mobileSettingsBtn = document.getElementById('mobile-settings-btn');
const mobileFeedbackBtn = document.getElementById('mobile-feedback-btn');
const mobileHistoryContainer = document.getElementById('mobile-history-items-container');

let useFirstAvatar = true;
const botAvatarImage1 = '/image/smoky_klein.png';
const botAvatarImage2 = '/image/stu_klein.png';

export function showToast(message) {
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

export function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

export function updateTime() {
    const settings = getSettings();
    const timeEl = document.getElementById('current-time');
    if (timeEl) {
        const now = new Date();
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: settings.timestampFormat === '12h',
        };
        timeEl.textContent = now.toLocaleTimeString('de-DE', timeOptions);
    }
}

export function addMessage(text, isUser, timestamp, copyable = false, save = true) {
    const settings = getSettings();
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
    
    bubble.innerHTML = renderMarkup(text);

    if (!isUser && copyable) {
        const c = document.createElement('span');
        c.className = 'copy-btn';
        c.innerHTML = '<i class="fas fa-copy"></i>';
        c.addEventListener('click', () => navigator.clipboard.writeText(text));
        bubble.appendChild(c);
    }
    
    const md = document.createElement('div');
    md.className = 'metadata';
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: settings.timestampFormat === '12h',
    };
    md.textContent = new Date(timestamp).toLocaleTimeString('de-DE', timeOptions);
    bubble.appendChild(md);

    m.appendChild(bubble);
   
    messagesEl.appendChild(m);

    // The MutationObserver will handle image processing now.
    scrollToBottom();
}

export function setupUI(app) {
    // --- MutationObserver to process images in new bubbles ---
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            const bubblesToProcess = new Set();

            // Check nodes that were added
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    // If the added node is a message itself or contains one
                    const bubble = node.querySelector ? (node.classList.contains('bubble') ? node : node.querySelector('.bubble')) : null;
                    if (bubble) {
                        bubblesToProcess.add(bubble);
                    }
                    // If the added node is inside a bubble
                    else if (node.parentElement) {
                        const parentBubble = node.parentElement.closest('.bubble');
                        if (parentBubble) bubblesToProcess.add(parentBubble);
                    }
                }
            });

            // Also consider the mutation target for text changes, etc.
            if (mutation.target.nodeType === 1) {
                const targetBubble = mutation.target.classList.contains('bubble') ? mutation.target : mutation.target.closest('.bubble');
                if (targetBubble) bubblesToProcess.add(targetBubble);
            }

            bubblesToProcess.forEach(bubble => {
                processImagesInBubble(bubble);
            });
        });
    });

    observer.observe(messagesEl, { childList: true, subtree: true });

    // Event Listeners
    sendBtnEl.addEventListener('click', () => app.send()); 
    chatInput.addEventListener('keydown', (e) => {
        const settings = getSettings();
        if (settings.sendWithEnter && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            app.send();
        } else if (!settings.sendWithEnter && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            app.send();
        }
    });
    
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = `${chatInput.scrollHeight}px`;
    });

    settingsBtn.addEventListener("click", () => { 
        app.openSettings();
    });
    
    closeSettingsBtn.addEventListener("click", () => app.closeSettings());
    saveSettingsBtn.addEventListener('click', () => app.saveSettings());
    resetSettingsBtn.addEventListener('click', () => app.resetSettings());
    
    newChatBtn.addEventListener('click', () => app.startNewChat());

    const deleteAllChatsBtn = document.getElementById('delete-all-chats-btn');
    const exportBtn = document.getElementById('export-history-btn');
    const importBtn = document.getElementById('import-history-btn');
    const importInput = document.getElementById('import-history-input');

    if (deleteAllChatsBtn) {
        deleteAllChatsBtn.addEventListener('click', () => app.deleteAllChats());
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => exportHistory());
    }

    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                importHistory(e.target.files[0], app);
            }
            e.target.value = null; // Reset file input
        });
    }
    
    feedbackBtn.addEventListener("click", () => {
        app.openFeedback();
    });
    closeFeedbackBtn.addEventListener("click", () => app.closeFeedback());
    sendFeedbackBtn.addEventListener('click', () => app.sendFeedback());
    feedbackLanguageSelect.addEventListener('change', (e) => app.setFeedbackLanguage(e.target.value));
    
    // Mobile Menu Listeners
    if (hamburgerBtn) hamburgerBtn.addEventListener('click', app.openMobileMenu);
    if (closeMobileMenuBtn) closeMobileMenuBtn.addEventListener('click', app.closeMobileMenu);
    if (mobileMenuOverlay) mobileMenuOverlay.addEventListener('click', app.closeMobileMenu);
    
    if (mobileNewChatBtn) {
        mobileNewChatBtn.addEventListener('click', () => {
            app.startNewChat();
            app.closeMobileMenu();
        });
    }
    if (mobileSettingsBtn) {
        mobileSettingsBtn.addEventListener('click', () => {
            app.openSettings();
            app.closeMobileMenu();
        });
    }
    if (mobileFeedbackBtn) {
        mobileFeedbackBtn.addEventListener('click', () => {
            app.openFeedback();
            app.closeMobileMenu();
        });
    }

    document.querySelector('#settings-modal .modal-body').addEventListener('input', (e) => app.handleSettingChange(e));
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (app.settings.theme === 'system') {
            app.applySettings();
        }
    });
}

export function renderChatHistory(history, currentConversationId, loadChat, closeMobileMenu) {
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
            if (chat.id === currentConversationId) {
                historyItem.classList.add('active');
            }
            historyItem.addEventListener('click', (e) => {
                e.preventDefault();
                loadChat(chat.id);
                closeMobileMenu();
            });
            container.appendChild(historyItem);
        });
    });
}

export function updateSettingsUI(settings) {
    Object.keys(settings).forEach(key => {
        const elId = `setting-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
        const el = document.getElementById(elId);
        if (!el) return;

        if (el.type === 'checkbox') {
            el.checked = settings[key];
        } else if (el.classList.contains('image-picker')) {
            const selectedRadio = el.querySelector(`input[value="${settings[key]}"]`);
            if (selectedRadio) {
                selectedRadio.checked = true;
            }
        } else {
            el.value = settings[key];
        }
    });
    document.getElementById('accent-color').value = settings.accentColor;
}

export function applyUI(settings) {
    const root = document.documentElement;
    // Language
    setSettingsLanguage(settings.uiLanguage);

    // Theme
    const isDarkMode = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark-mode', isDarkMode);
    
    // Logo switching for dark theme
    const logos = document.querySelectorAll('.logo, .header-logo');
    logos.forEach(logo => {
        if (isDarkMode) {
            logo.src = logo.src.replace('HTW.svg', 'HTW_hell.png');
        } else {
            logo.src = logo.src.replace('HTW_hell.png', 'HTW.svg');
        }
    });
    
    // Accent Color
    root.style.setProperty('--accent-color', settings.accentColor);
    
    // Font Size
    const fontSizes = { small: '14px', medium: '16px', large: '18px' };
    root.style.fontSize = fontSizes[settings.fontSize] || '16px';
    
    // Layout Density
    const densities = { compact: '0.8', standard: '1', spacious: '1.2' };
    root.style.setProperty('--layout-density-multiplier', densities[settings.layoutDensity] || '1');
    
    // Animation Speed
    const speeds = { normal: '1', reduced: '0.5', none: '0' };
    root.style.setProperty('--animation-speed-multiplier', speeds[settings.animationSpeed] || '1');
    
    // Max Chat Width
    const widths = { default: '1350px', medium: '1000px', small: '800px', full: '100%' };
    root.style.setProperty('--max-chat-width', widths[settings.maxChatWidth] || '1350px');

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

    // Update the clock to reflect potential format changes
    updateTime();
}

export function setSettingsLanguage(lang) {
    const translations = i18n[lang] || i18n.de;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[key]) {
            el.textContent = translations[key];
        }
    });
}

export function setFeedbackLanguage(lang) {
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

export function openMobileMenu() {
    if (mobileMenu && mobileMenuOverlay) {
        mobileMenu.classList.add('open');
        mobileMenuOverlay.classList.add('open');
    }
}

export function closeMobileMenu() {
    if (mobileMenu && mobileMenuOverlay) {
        mobileMenu.classList.remove('open');
        mobileMenuOverlay.classList.remove('open');
    }
}

export function startWelcomeAnimation() {
    const welcomeBubble = document.querySelector('#welcome-message .bubble');
    const welcomeText = document.querySelector('#welcome-message .bubble span');
    if (!welcomeBubble || !welcomeText) return;

    const messages = [
        "Hallo! Ich bin dein AI-Assistent der HTW Dresden.",
        "Hello! I am your AI assistant from HTW Dresden.",
        "你好！我是你来自德累斯顿应用技术大学的 AI 助手。"
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

    if (window.welcomeInterval) clearInterval(window.welcomeInterval);
    window.welcomeInterval = setInterval(updateMessage, 4000);
}

export function stopWelcomeAnimation() {
    if (window.welcomeInterval) {
        clearInterval(window.welcomeInterval);
        window.welcomeInterval = null;
    }
}

export function openModal(modal) {
    if(modal) modal.classList.add('open');
}

export function closeModal(modal) {
    if(modal) modal.classList.remove('open');
}

export function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const expectedCaptcha = num1 + num2;
    document.getElementById('captcha-question').textContent = `${num1} + ${num2} = ?`;
    document.getElementById('captcha-input').value = '';
    return expectedCaptcha;
}

export function populateChatHistoryDropdown() {
    const history = getChatHistory();
    const select = document.getElementById('feedback-chat-history');
    if (!select) return;

    // Clear existing options except the first one
    while (select.options.length > 1) {
        select.remove(1);
    }

    history.forEach(chat => {
        const option = document.createElement('option');
        option.value = chat.id;
        option.textContent = chat.title;
        select.appendChild(option);
    });
}

export function showCreditsAnimation() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = ''; // Clear the chat

    const credits = [
        { name: 'Dieses Projekt wurde in Zusammenarbeit von StuRa und Faranto entwickelt, danke an alle Untersützer:', avatar: '/image/HTW.svg' },
        { name: 'Nick', avatar: '/image/stu_klein.png' },
        { name: 'Jan', avatar: '/image/smoky_klein.png' },
        { name: 'Hannes', avatar: '/image/smoky_klein.png' },
        { name: 'Nina', avatar: '/image/smoky_klein.png' },
        { name: 'Sally', avatar: '/image/smoky_klein.png' },
        { name: 'Tommy', avatar: '/image/stu_klein.png' },
        { name: 'Danke für die tolle Zusammenarbeit!', avatar: '/image/FarantoStura.png' }
    ];

    let delay = 500; // Start delay
    credits.forEach((credit, index) => {
        setTimeout(() => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ai credit-message';
            // Stagger the animation delay for each message
            messageDiv.style.animationDelay = `${index * 0.2}s`;

            messageDiv.innerHTML = `
                <div class="avatar">
                    <img src="${credit.avatar}" alt="Avatar">
                </div>
                <div class="bubble">
                    <span>${credit.name}</span>
                </div>
            `;
            messagesContainer.appendChild(messageDiv);
            scrollToBottom();
        }, delay);
        delay += 700; // Increase delay for the next message
    });
}
