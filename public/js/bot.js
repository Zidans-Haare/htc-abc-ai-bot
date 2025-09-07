import { setupUI, addMessage, scrollToBottom, renderChatHistory, updateTime, showToast, openModal, closeModal, generateCaptcha, populateChatHistoryDropdown, showCreditsAnimation } from './ui.js';
import { getCurrentConversation, startNewConversation, updateConversationTitle, getChatHistory, deleteAllHistory, saveHistory, exportHistory as exportChatHistory, importHistory as importChatHistory } from './history.js';
import { loadSettings, saveSettings, resetSettings, handleSettingChange, getSettings, openSettings, closeSettings } from './settings.js';
import { fetchWithToken } from './api.js';
import { setupApiKeyModal } from './api_guide.js';

class ChatApp {
    constructor() {
        this.conversation = null;
        this.settings = getSettings();
        this.expectedCaptcha = null;
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            setupUI(this);
            this.loadSettings();
            this.loadChatHistory();
            this.conversation = getCurrentConversation();
            if (this.conversation && this.conversation.messages.length > 0) {
                this.renderConversation();
            } else {
                this.startNewChat();
            }
            updateTime();
            setInterval(updateTime, 60000);
            setupApiKeyModal();
        });
    }

    async send() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        if (text.toLowerCase() === 'credits') {
            showCreditsAnimation();
            input.value = '';
            input.style.height = 'auto';
            return;
        }

        addMessage(text, true, Date.now());
        this.conversation.messages.push({ role: 'user', parts: [{ text }], timestamp: Date.now() });
        input.value = '';
        input.style.height = 'auto';
        document.getElementById('typing').style.display = 'block';

        try {
            const response = await fetchWithToken('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: text, 
                    conversationId: this.conversation.id,
                    history: this.conversation.messages.slice(0, -1)
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            addMessage(data.text, false, Date.now(), true);
            this.conversation.messages.push({ role: 'model', parts: [{ text: data.text }], timestamp: Date.now() });
            
            if (this.conversation.messages.length === 2) {
                this.updateTitle(text);
            }
            
            this.saveCurrentChat();

        } catch (error) {
            console.error('Error:', error);
            addMessage(`Sorry, there was an error: ${error.message}`, false, Date.now());
        } finally {
            document.getElementById('typing').style.display = 'none';
        }
    }

    async updateTitle(prompt) {
        try {
            const response = await fetchWithToken('/api/gemini/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            if (!response.ok) throw new Error('Failed to get title');
            const data = await response.json();
            updateConversationTitle(this.conversation.id, data.title);
            this.loadChatHistory();
        } catch (error) {
            console.error("Failed to update title:", error);
        }
    }

    loadChatHistory() {
        const history = getChatHistory();
        const currentId = this.conversation ? this.conversation.id : null;
        renderChatHistory(history, currentId, (id) => this.loadChat(id), () => this.closeMobileMenu());
    }

    loadChat(id) {
        this.conversation = getChatHistory().find(c => c.id === id);
        this.renderConversation();
        this.loadChatHistory();
    }

    renderConversation() {
        const messagesEl = document.getElementById('messages');
        messagesEl.innerHTML = '';
        this.conversation.messages.forEach(msg => {
            addMessage(msg.parts[0].text, msg.role === 'user', msg.timestamp, msg.role !== 'user', false);
        });
    }

    startNewChat() {
        this.conversation = startNewConversation();
        document.getElementById('messages').innerHTML = '';
        this.loadChatHistory();
    }

    saveCurrentChat() {
        if (this.settings.saveHistory) {
            saveHistory(this.conversation);
        }
    }
    
    deleteAllChats() {
        if (confirm("Möchten Sie wirklich alle Chats löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) {
            deleteAllHistory();
            this.startNewChat();
            showToast("Alle Chats wurden gelöscht.");
        }
    }

    // --- Settings ---
    loadSettings() { loadSettings(); this.settings = getSettings(); }
    saveSettings() { saveSettings(); this.settings = getSettings(); }
    resetSettings() { resetSettings(); this.settings = getSettings(); }
    handleSettingChange(e) { handleSettingChange(e); }
    openSettings() { openSettings(); }
    closeSettings() { closeSettings(); }

    // --- Feedback ---
    openFeedback() {
        this.expectedCaptcha = generateCaptcha();
        populateChatHistoryDropdown();
        openModal(document.getElementById('feedback-modal'));
    }
    closeFeedback() {
        closeModal(document.getElementById('feedback-modal'));
    }
    async sendFeedback() {
        const feedbackInput = document.getElementById('feedback-input');
        const emailInput = document.getElementById('feedback-email');
        const captchaInput = document.getElementById('captcha-input');
        const chatHistorySelect = document.getElementById('feedback-chat-history');

        const feedback = feedbackInput.value.trim();
        const email = emailInput.value.trim();
        const captcha = captchaInput.value.trim();
        const chatId = chatHistorySelect.value;

        if (!feedback) {
            showToast("Bitte geben Sie eine Nachricht ein.");
            return;
        }
        if (parseInt(captcha, 10) !== this.expectedCaptcha) {
            showToast("Die Antwort auf die Sicherheitsfrage ist falsch.");
            this.expectedCaptcha = generateCaptcha();
            return;
        }

        try {
            const response = await fetchWithToken('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedback, email, chatId })
            });
            if (!response.ok) throw new Error('Failed to send feedback');
            showToast("Vielen Dank für Ihr Feedback!");
            this.closeFeedback();
            feedbackInput.value = '';
            emailInput.value = '';
        } catch (error) {
            console.error("Feedback error:", error);
            showToast("Fehler beim Senden des Feedbacks.");
        }
    }
    setFeedbackLanguage(lang) {
        setFeedbackLanguage(lang);
    }
    
    // --- Mobile Menu ---
    openMobileMenu() {
        document.getElementById('mobile-menu').classList.add('open');
        document.getElementById('mobile-menu-overlay').classList.add('open');
    }
    closeMobileMenu() {
        document.getElementById('mobile-menu').classList.remove('open');
        document.getElementById('mobile-menu-overlay').classList.remove('open');
    }

    // --- History Import/Export ---
    exportHistory() {
        exportChatHistory();
    }

    importHistory(file) {
        importChatHistory(file, this);
    }
}

const app = new ChatApp();
window.app = app;