import { setupUI, addMessage, showToast, scrollToBottom, updateTime, renderChatHistory, openMobileMenu, closeMobileMenu, startWelcomeAnimation, stopWelcomeAnimation, openModal, closeModal, generateCaptcha, setFeedbackLanguage, populateChatHistoryDropdown, showCreditsAnimation } from '../components/ui.js';
import { loadSettings, saveSettings, resetSettings, handleSettingChange, getSettings, openSettings, closeSettings } from '../components/settings.js';
import { deleteAllChats, autoDeleteOldChats, loadChat, saveMessageToHistory, getChatHistory } from '../components/history.js';
import { sendMsg, sendFeedback } from '../components/api.js';
import { initSession, login as authLogin, register as authRegister, logout as authLogout, onAuthChange, updateProfile as persistProfile, getAuthState } from '../components/authClient.js';

// Function to get or create an anonymous user ID
function getAnonymousUserId() {
    let userId = localStorage.getItem('anonymousUserId');
    if (!userId) {
        userId = self.crypto.randomUUID();
        localStorage.setItem('anonymousUserId', userId);
    }
    return userId;
}

document.addEventListener('DOMContentLoaded', () => {
    const app = {
        conversationId: null,
        anonymousUserId: getAnonymousUserId(), // Get the user ID on init
        expectedCaptcha: null,
        useFirstAvatar: true,
        settings: getSettings(),
        auth: {
            isAuthenticated: false,
            profile: null,
            role: null,
            username: null,
        },

        init() {
            loadSettings();
            this.settings = getSettings();
            autoDeleteOldChats(this.settings);
            this.renderHistory();
            
            updateTime();
            setInterval(updateTime, 1000 * 60);

            this.startNewChat();
            setupUI(this);
            this.setupAuthUI();
            this.setupSuggestionListeners();
            this.loadSuggestions();
        },

        async loadSuggestions() {
            const suggestionsContainer = document.getElementById('prompt-suggestions');
            if (!suggestionsContainer) return;

            const favorites = (this.auth?.profile?.favoritePrompts || []).map(item => ({
                article: item.title,
                description: item.prompt,
                isFavorite: true,
            }));

            try {
                const response = await fetch('/api/suggestions');
                if (!response.ok) throw new Error('Failed to load suggestions');

                const suggestions = await response.json();
                const combined = [
                    ...favorites,
                    ...suggestions.map(item => ({ ...item, isFavorite: false })),
                ];

                if (combined.length === 0) {
                    // No favorites and backend returned nothing, fall back to static message
                    suggestionsContainer.innerHTML = '<p style="color: var(--secondary-text); text-align: center;">Keine Vorschläge verfügbar.</p>';
                    return;
                }

                this.renderSuggestionCards(combined);
            } catch (error) {
                console.error('Error loading suggestions:', error);
                if (favorites.length > 0) {
                    this.renderSuggestionCards(favorites);
                } else {
                    suggestionsContainer.innerHTML = '<p style="color: var(--secondary-text); text-align: center;">Vorschläge konnten nicht geladen werden.</p>';
                }
            }
        },

        renderSuggestionCards(items) {
            const container = document.getElementById('prompt-suggestions');
            if (!container) return;
            container.innerHTML = '';

            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'suggestion-card';
                if (item.isFavorite) {
                    card.classList.add('suggestion-card--favorite');
                }

                const title = document.createElement('h4');
                title.textContent = item.article;

                const text = document.createElement('p');
                text.textContent = item.description;

                card.appendChild(title);
                card.appendChild(text);
                container.appendChild(card);
            });
        },

        send(promptText) {
            const text = promptText || document.getElementById('chat-input').value.trim();
            const lowerCaseText = text.toLowerCase();
            // Even more robust keywords
            const easterEggKeywords = ['credits', 'entwickl', 'danke', 'mitwirkende', 'zusammenarbeit'];

            if (easterEggKeywords.some(keyword => lowerCaseText.includes(keyword))) {
                showCreditsAnimation();
                document.getElementById('chat-input').value = '';
            } else {
                sendMsg(this, text);
            }
        },

        addMessage(text, isUser, timestamp, copyable = false, save = true) {
            addMessage(text, isUser, timestamp, copyable, save);
        },

        startNewChat() {
            this.conversationId = null;
            const welcomeText = this.getPersonalWelcome();
            document.getElementById('messages').innerHTML = `
                <div id="welcome-message">
                    <div class="message ai">
                        <div class="avatar">
                            <img src="/assets/images/smoky_klein.png" alt="Bot Avatar">
                        </div>
                        <div class="bubble">
                            <span>${welcomeText}</span>
                        </div>
                    </div>
                </div>`;
            const suggestions = document.getElementById('prompt-suggestions');
            if (suggestions) {
                suggestions.style.display = 'flex';
            }
            this.useFirstAvatar = true;
            startWelcomeAnimation();
            
            document.querySelectorAll('.history-item.active').forEach(item => item.classList.remove('active'));
        },

        renderHistory() {
            const history = getChatHistory();
            renderChatHistory(history, this.conversationId, (id) => this.loadChat(id), () => this.closeMobileMenu());
        },

        getPersonalWelcome() {
            const profile = this.auth?.profile;
            if (profile && profile.displayName) {
                return `Hallo ${profile.displayName}! Was kann ich heute für dich erledigen?`;
            }
            return 'Hallo! Ich bin dein AI-Assistent der HTW Dresden. Wie kann ich dir helfen?';
        },

        loadChat(id) {
            loadChat(id, this);
        },

        async saveSettings() {
            saveSettings();
            this.settings = getSettings();

            if (this.auth?.isAuthenticated) {
                try {
                    const payload = this.collectProfileFormData();
                    const profile = await persistProfile(payload);
                    this.auth.profile = profile;
                    this.applyProfile(profile);
                    showToast('Profil gespeichert.');
                } catch (error) {
                    console.error('Profil speichern fehlgeschlagen:', error);
                    showToast('Profil konnte nicht gespeichert werden.');
                }
            }

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
            if (deleteAllChats(this)) {
                this.renderHistory();
                showToast("Alle Verläufe wurden gelöscht.");
            }
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
            const suggestionsContainer = document.getElementById('prompt-suggestions');
            if (suggestionsContainer) {
                suggestionsContainer.addEventListener('click', (e) => {
                    const card = e.target.closest('.suggestion-card');
                    if (card && card.contains(e.target)) {
                        const promptText = card.querySelector('p').textContent;
                        this.send(promptText);
                    }
                });
            }
        },

        setupAuthUI() {
            const elements = {
                trigger: document.getElementById('auth-trigger'),
                label: document.getElementById('auth-label'),
                menu: document.getElementById('auth-menu'),
                greeting: document.getElementById('auth-greeting'),
                openProfile: document.getElementById('open-profile'),
                logout: document.getElementById('logout-btn'),
                authModal: document.getElementById('auth-modal'),
                closeAuth: document.getElementById('close-auth'),
                authTabs: document.querySelectorAll('.auth-tab'),
                loginForm: document.getElementById('login-form'),
                registerForm: document.getElementById('register-form'),
                registerEmail: document.getElementById('register-email'),
                registerDisplayName: document.getElementById('register-display-name'),
                registerPassword: document.getElementById('register-password'),
                loginEmail: document.getElementById('login-email'),
                loginPassword: document.getElementById('login-password'),
                profileSection: document.getElementById('profile-settings-section'),
                profileEmail: document.getElementById('profile-email'),
                displayNameInput: document.getElementById('profile-display-name'),
                prefVegetarian: document.getElementById('pref-vegetarian'),
                prefVegan: document.getElementById('pref-vegan'),
                prefGluten: document.getElementById('pref-gluten'),
                favoriteList: document.getElementById('favorites-list'),
                addFavorite: document.getElementById('add-favorite-btn'),
                favoriteTemplate: document.getElementById('favorite-template'),
            };
            this.authUI = elements;

            if (elements.trigger) {
                elements.trigger.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const state = getAuthState();
                    if (!state.isAuthenticated) {
                        this.openAuthModal('login');
                    } else {
                        elements.menu.classList.toggle('hidden');
                    }
                });
            }

            document.addEventListener('click', (event) => {
                if (!elements.menu) return;
                const isClickInside = elements.menu.contains(event.target) || (elements.trigger && elements.trigger.contains(event.target));
                if (!isClickInside) {
                    elements.menu.classList.add('hidden');
                }
            });

            if (elements.closeAuth) {
                elements.closeAuth.addEventListener('click', () => this.closeAuthModal());
            }

            if (elements.authTabs) {
                elements.authTabs.forEach(tab => {
                    tab.addEventListener('click', () => {
                        const view = tab.dataset.authView;
                        this.switchAuthView(view);
                    });
                });
            }

            if (elements.loginForm) {
                elements.loginForm.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    const email = elements.loginEmail.value.trim();
                    const password = elements.loginPassword.value;
                    try {
                        await authLogin({ email, password });
                        showToast('Willkommen zurück!');
                        this.closeAuthModal();
                    } catch (error) {
                        console.error('Login fehlgeschlagen:', error);
                        showToast(error.message || 'Anmeldung fehlgeschlagen.');
                    }
                });
            }

            if (elements.registerForm) {
                elements.registerForm.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    const email = elements.registerEmail.value.trim();
                    const password = elements.registerPassword.value;
                    const displayName = elements.registerDisplayName.value.trim();
                    try {
                        await authRegister({ email, password, displayName });
                        showToast('Konto erstellt. Viel Spaß!');
                        this.closeAuthModal();
                    } catch (error) {
                        console.error('Registrierung fehlgeschlagen:', error);
                        showToast(error.message || 'Registrierung fehlgeschlagen.');
                    }
                });
            }

            if (elements.logout) {
                elements.logout.addEventListener('click', async () => {
                    await authLogout();
                    showToast('Abgemeldet. Bis bald!');
                    elements.menu.classList.add('hidden');
                });
            }

            if (elements.openProfile) {
                elements.openProfile.addEventListener('click', () => {
                    elements.menu.classList.add('hidden');
                    openSettings();
                    this.populateProfileForm(this.auth.profile);
                });
            }

            if (elements.addFavorite) {
                elements.addFavorite.addEventListener('click', () => {
                    this.addFavoriteRow();
                });
            }

            if (elements.favoriteList) {
                elements.favoriteList.addEventListener('click', (event) => {
                    const button = event.target.closest('.remove-favorite');
                    if (button) {
                        event.preventDefault();
                        const item = button.closest('.favorite-item');
                        if (item) item.remove();
                    }
                });
            }

            onAuthChange((state) => this.handleAuthChange(state));
            initSession();
        },

        handleAuthChange(state) {
            this.auth = {
                isAuthenticated: state.isAuthenticated,
                profile: state.profile,
                role: state.role,
                username: state.username,
            };

            this.updateAuthUI(state);
            if (state.isAuthenticated) {
                this.applyProfile(state.profile);
            } else {
                this.applyLoggedOutUI();
            }
        },

        updateAuthUI(state) {
            const ui = this.authUI;
            if (!ui) return;

            if (state.isAuthenticated) {
                ui.label.textContent = state.profile?.displayName ? `Hallo, ${state.profile.displayName}` : 'Angemeldet';
                if (ui.greeting) {
                    ui.greeting.textContent = state.profile?.displayName ? `Hallo ${state.profile.displayName}!` : 'Hallo!';
                }
                if (ui.profileSection) ui.profileSection.removeAttribute('hidden');
                if (ui.profileEmail) ui.profileEmail.textContent = state.username || '-';
            } else {
                ui.label.textContent = 'Anmelden';
                if (ui.menu) ui.menu.classList.add('hidden');
                if (ui.profileSection) ui.profileSection.setAttribute('hidden', '');
                if (ui.profileEmail) ui.profileEmail.textContent = '-';
            }
        },

        applyProfile(profile) {
            if (!profile) return;
            this.populateProfileForm(profile);
            this.loadSuggestions();

            const welcomeMessage = document.querySelector('#welcome-message .bubble span');
            if (welcomeMessage) {
                welcomeMessage.textContent = this.getPersonalWelcome();
            }
        },

        applyLoggedOutUI() {
            const ui = this.authUI;
            if (!ui) return;
            if (ui.profileSection) ui.profileSection.setAttribute('hidden', '');
            if (ui.favoriteList) ui.favoriteList.innerHTML = '';
            this.loadSuggestions();
            const welcomeMessage = document.querySelector('#welcome-message .bubble span');
            if (welcomeMessage) {
                welcomeMessage.textContent = this.getPersonalWelcome();
            }
        },

        openAuthModal(view = 'login') {
            const ui = this.authUI;
            if (!ui?.authModal) return;
            ui.authModal.classList.remove('hidden');
            ui.authModal.classList.add('visible');
            this.switchAuthView(view);
        },

        closeAuthModal() {
            const ui = this.authUI;
            if (!ui?.authModal) return;
            ui.authModal.classList.remove('visible');
            ui.authModal.classList.add('hidden');
        },

        switchAuthView(view) {
            const ui = this.authUI;
            if (!ui) return;
            const forms = [ui.loginForm, ui.registerForm];
            forms.forEach(form => {
                if (!form) return;
                if (form.dataset.authView === view) {
                    form.classList.remove('hidden');
                } else {
                    form.classList.add('hidden');
                }
            });
            if (ui.authTabs) {
                ui.authTabs.forEach(tab => {
                    if (tab.dataset.authView === view) {
                        tab.classList.add('active');
                    } else {
                        tab.classList.remove('active');
                    }
                });
            }
        },

        populateProfileForm(profile = null) {
            const ui = this.authUI;
            if (!ui) return;
            const prefs = profile?.mensaPreferences || {};
            if (ui.displayNameInput) ui.displayNameInput.value = profile?.displayName || '';
            if (ui.prefVegetarian) ui.prefVegetarian.checked = Boolean(prefs.vegetarian);
            if (ui.prefVegan) ui.prefVegan.checked = Boolean(prefs.vegan);
            if (ui.prefGluten) ui.prefGluten.checked = Boolean(prefs.glutenFree);

            this.renderFavoriteList(Array.isArray(profile?.favoritePrompts) ? profile.favoritePrompts : []);
        },

        renderFavoriteList(items) {
            const ui = this.authUI;
            if (!ui?.favoriteList || !ui?.favoriteTemplate) return;
            ui.favoriteList.innerHTML = '';
            items.slice(0, 12).forEach(item => this.addFavoriteRow(item));
        },

        addFavoriteRow(data = null) {
            const ui = this.authUI;
            if (!ui?.favoriteList || !ui?.favoriteTemplate) return;
            if (ui.favoriteList.childElementCount >= 12) {
                showToast('Maximal 12 Lieblingsfragen möglich.');
                return;
            }
            const clone = ui.favoriteTemplate.content.cloneNode(true);
            const wrapper = clone.querySelector('.favorite-item');
            const title = clone.querySelector('.favorite-title');
            const prompt = clone.querySelector('.favorite-prompt');
            if (data) {
                title.value = data.title || '';
                prompt.value = data.prompt || '';
            }
            ui.favoriteList.appendChild(clone);
        },

        collectProfileFormData() {
            const ui = this.authUI;
            if (!ui) return {};
            const mensaPreferences = {
                vegetarian: ui.prefVegetarian?.checked || false,
                vegan: ui.prefVegan?.checked || false,
                glutenFree: ui.prefGluten?.checked || false,
                favoriteCanteens: this.auth?.profile?.mensaPreferences?.favoriteCanteens || [],
            };

            const favorites = Array.from(ui.favoriteList?.querySelectorAll('.favorite-item') || [])
                .map(item => {
                    const title = item.querySelector('.favorite-title')?.value.trim();
                    const prompt = item.querySelector('.favorite-prompt')?.value.trim();
                    if (!title || !prompt) return null;
                    return { title, prompt };
                })
                .filter(Boolean);

            return {
                display_name: ui.displayNameInput?.value.trim() || null,
                mensa_preferences: mensaPreferences,
                favorite_prompts: favorites,
                ui_settings: this.auth?.profile?.uiSettings || {},
            };
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
