import { setupUI, addMessage, showToast, scrollToBottom, updateTime, renderChatHistory, openMobileMenu, closeMobileMenu, startWelcomeAnimation, stopWelcomeAnimation, openModal, closeModal, generateCaptcha, setFeedbackLanguage, populateChatHistoryDropdown } from './js/ui.js';
import { loadSettings, saveSettings, resetSettings, handleSettingChange, getSettings, openSettings, closeSettings } from './js/settings.js';
import { deleteAllChats, autoDeleteOldChats, loadChat, saveMessageToHistory, getChatHistory } from './js/history.js';
import { sendMsg, sendFeedback } from './js/api.js';

document.addEventListener('DOMContentLoaded', () => {
    const app = {
        conversationId: null,
        expectedCaptcha: null,
        useFirstAvatar: true,
        settings: getSettings(),

        init() {
            loadSettings();
            this.settings = getSettings();
            autoDeleteOldChats(this.settings);
            this.renderHistory();
            
            updateTime();
            setInterval(updateTime, 1000 * 60);

            this.startNewChat();
            setupUI(this);
            this.setupSuggestionListeners();
        },

        send(promptText) {
            sendMsg(this, promptText);
        },

        addMessage(text, isUser, timestamp, copyable = false, save = true) {
            addMessage(text, isUser, timestamp, copyable, save);
            if (save && this.settings.saveHistory) {
                saveMessageToHistory(this.conversationId, text, isUser, text);
            }
        },

        startNewChat() {
            this.conversationId = null;
            document.getElementById('messages').innerHTML = `
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
            this.useFirstAvatar = true;
            startWelcomeAnimation();
            this.setupSuggestionListeners();
            
            document.querySelectorAll('.history-item.active').forEach(item => item.classList.remove('active'));
        },

        renderHistory() {
            const history = getChatHistory();
            renderChatHistory(history, this.conversationId, (id) => this.loadChat(id), () => this.closeMobileMenu());
        },

        loadChat(id) {
            loadChat(id, this);
        },

        saveSettings() {
            saveSettings();
            this.settings = getSettings();
            closeModal(document.getElementById('settings-modal'));
        },

        resetSettings() {
            resetSettings();
            this.settings = getSettings();
        },

        openSettings() {
            openSettings();
        },

        closeSettings() {
            closeSettings();
        },

        handleSettingChange(e) {
            handleSettingChange(e);
        },

        deleteAllChats() {
            deleteAllChats(this);
        },

        openFeedback() {
            this.expectedCaptcha = generateCaptcha();
            populateChatHistoryDropdown();
            openModal(document.getElementById('feedback-modal'));
        },

        closeFeedback() {
            closeModal(document.getElementById('feedback-modal'));
        },

        sendFeedback() {
            sendFeedback(this);
        },

        setFeedbackLanguage(lang) {
            setFeedbackLanguage(lang);
        },

        openMobileMenu() {
            openMobileMenu();
        },

        closeMobileMenu() {
            closeMobileMenu();
        },

        setupSuggestionListeners() {
            const suggestions = document.getElementById('prompt-suggestions');
            if (suggestions) {
                suggestions.addEventListener('click', (e) => {
                    const card = e.target.closest('.suggestion-card');
                    if (card) {
                        const promptText = card.querySelector('p').textContent;
                        this.send(promptText);
                    }
                });
            }
        },

        scrollToBottom() {
            scrollToBottom();
        },

        saveMessageToHistory(conversationId, message, isUser, fullResponse) {
            saveMessageToHistory(conversationId, message, isUser, fullResponse);
            this.renderHistory();
        }
    };

    app.init();
});
