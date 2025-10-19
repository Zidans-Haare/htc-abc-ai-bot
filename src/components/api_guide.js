document.addEventListener('DOMContentLoaded', () => {
    const apiKeyModal = document.getElementById('api-key-modal');
    if (!apiKeyModal) return;

    const openBtn = document.getElementById('configure-api-key-btn');
    const closeBtn = document.getElementById('close-api-key-modal');
    
    const prevBtn = document.getElementById('api-guide-prev');
    const nextBtn = document.getElementById('api-guide-next');
    const saveBtn = document.getElementById('api-guide-save');

    const steps = Array.from(document.querySelectorAll('.api-guide-step'));
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeyStatus = document.getElementById('api-key-status');
    const apiKeyError = document.getElementById('api-key-error');
    const languageSelect = document.getElementById('api-language-select');

    let currentStep = 0;

    const API_KEY_STORAGE_ITEM = 'user_api_key';

    // Language translations
    const translations = {
        de: {
            modal_title: "Persönlichen API-Schlüssel einrichten",
            step1_title: "Schritt 1: Höhere Limits freischalten!",
            step1_description1: "Um die Kosten für alle niedrig zu halten, haben wir ein allgemeines Limit für Anfragen. Du kannst dieses Limit umgehen, indem du deinen eigenen, kostenlosen Google AI API-Schlüssel verwendest.",
            step1_description2: "Wir führen dich in wenigen Schritten durch den Prozess.",
            step2_title: "Schritt 2: Deinen Schlüssel holen",
            step2_description: "Klicke auf den folgenden Link, um das Google AI Studio in einem neuen Tab zu öffnen. Melde dich mit deinem Google-Konto an, falls nötig.",
            step2_link: "Google AI Studio öffnen",
            step3_title: "Schritt 3: API-Schlüssel erstellen",
            step3_description1: "Klicke im Google AI Studio auf die Schaltfläche:",
            step3_button: "+ Create API key in new project",
            step3_description2: "Es wird eine lange Zeichenkette generiert. Das ist dein persönlicher Schlüssel.",
            step4_title: "Schritt 4: Fast geschafft!",
            step4_description: "Kopiere den generierten API-Schlüssel und füge ihn in das Feld unten ein.",
            step4_placeholder: "API-Schlüssel hier einfügen",
            btn_back: "Zurück",
            btn_next: "Weiter",
            btn_save: "Speichern & Aktivieren",
            validation_short: "Bitte gib einen gültigen API-Schlüssel ein.",
            validation_checking: "Überprüfe...",
            validation_success: "API-Schlüssel erfolgreich gespeichert und verifiziert!",
            validation_invalid: "Der API-Schlüssel ist ungültig oder es gab einen Serverfehler.",
            validation_network: "Ein Netzwerkfehler ist aufgetreten. Bitte versuche es später erneut.",
            status_configured: "Konfiguriert",
            status_not_configured: "Nicht konfiguriert",
            btn_configure: "Konfigurieren & Limits aufheben",
            btn_change: "Ändern"
        },
        en: {
            modal_title: "Set up Personal API Key",
            step1_title: "Step 1: Unlock Higher Limits!",
            step1_description1: "To keep costs low for everyone, we have a general limit on requests. You can bypass this limit by using your own free Google AI API key.",
            step1_description2: "We'll guide you through the process in a few steps.",
            step2_title: "Step 2: Get Your Key",
            step2_description: "Click the following link to open Google AI Studio in a new tab. Sign in with your Google account if necessary.",
            step2_link: "Open Google AI Studio",
            step3_title: "Step 3: Create API Key",
            step3_description1: "Click the button in Google AI Studio:",
            step3_button: "+ Create API key in new project",
            step3_description2: "A long string will be generated. This is your personal key.",
            step4_title: "Step 4: Almost Done!",
            step4_description: "Copy the generated API key and paste it in the field below.",
            step4_placeholder: "Paste API key here",
            btn_back: "Back",
            btn_next: "Next",
            btn_save: "Save & Activate",
            validation_short: "Please enter a valid API key.",
            validation_checking: "Checking...",
            validation_success: "API key successfully saved and verified!",
            validation_invalid: "The API key is invalid or there was a server error.",
            validation_network: "A network error occurred. Please try again later.",
            status_configured: "Configured",
            status_not_configured: "Not configured",
            btn_configure: "Configure & Remove Limits",
            btn_change: "Change"
        }
    };

    let currentLanguage = 'de'; // Default language

    // Function to update all texts based on selected language
    function updateLanguage(lang) {
        currentLanguage = lang;
        const trans = translations[lang];

        // Update modal title
        document.querySelector('.modal-title[data-lang-key="modal_title"]').textContent = trans.modal_title;

        // Update all elements with data-lang-key
        document.querySelectorAll('[data-lang-key]').forEach(element => {
            const key = element.getAttribute('data-lang-key');
            if (trans[key]) {
                if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
                    element.placeholder = trans[key];
                } else {
                    element.textContent = trans[key];
                }
            }
        });

        // Update placeholders
        document.querySelectorAll('[data-lang-placeholder]').forEach(element => {
            const key = element.getAttribute('data-lang-placeholder');
            if (trans[key]) {
                element.placeholder = trans[key];
            }
        });

        // Update button texts that don't have data-lang-key
        saveBtn.textContent = trans.btn_save;
        if (typeof storedKey !== 'undefined') {
            openBtn.textContent = trans.btn_change 
        } else {
             trans.btn_configure;
        }
    }

    function updateButtonStates() {
        prevBtn.disabled = currentStep === 0;
        
        if (currentStep === steps.length - 1) {
            nextBtn.classList.add('modal-hidden');
            saveBtn.classList.remove('modal-hidden');
        } else {
            nextBtn.classList.remove('modal-hidden');
            saveBtn.classList.add('modal-hidden');
        }
    }

    function showStep(stepIndex) {
        steps.forEach((step, index) => {
            if (index === stepIndex) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
        currentStep = stepIndex;
        updateButtonStates();
    }

    function openModal() {
        apiKeyModal.classList.remove('modal-hidden');
        showStep(0);
    }

    function closeModal() {
        apiKeyModal.classList.add('modal-hidden');
    }

    async function saveApiKey() {
        const key = apiKeyInput.value.trim();
        const trans = translations[currentLanguage];

        if (key.length < 10) { // Basic validation
            apiKeyError.textContent = trans.validation_short;
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = trans.validation_checking;
        apiKeyError.textContent = '';

        try {
            const response = await fetch('/api/test-api-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    apiKey: key,
                    language: currentLanguage
                }),
            });

            if (response.ok) {
                localStorage.setItem(API_KEY_STORAGE_ITEM, key);
                updateApiKeyStatus();
                closeModal();
                window.showToast(trans.validation_success);
            } else {
                let errorMessage = trans.validation_invalid;
                try {
                    // Try to parse the error response as JSON
                    const errorData = await response.json();
                    if (errorData && errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {
                    // If JSON parsing fails, the response might be plain text or an HTML error page
                    const errorText = await response.text();
                    if (errorText) {
                        // Display the raw text response to see what the server is actually sending
                        errorMessage = currentLanguage === 'de'
                            ? `Unerwartete Server-Antwort: ${errorText.substring(0, 300)}`
                            : `Unexpected server response: ${errorText.substring(0, 300)}`;
                    }
                }
                apiKeyError.textContent = errorMessage;
            }
        } catch (error) {
            apiKeyError.textContent = trans.validation_network;
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = trans.btn_save;
        }
    }

    function updateApiKeyStatus() {
        const storedKey = localStorage.getItem(API_KEY_STORAGE_ITEM);
        const trans = translations[currentLanguage];

        if (storedKey) {
            apiKeyStatus.textContent = trans.status_configured;
            apiKeyStatus.classList.add('configured');
            openBtn.textContent = trans.btn_change;
        } else {
            apiKeyStatus.textContent = trans.status_not_configured;
            apiKeyStatus.classList.remove('configured');
            openBtn.textContent = trans.btn_configure;
        }
    }

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

    // Language selection event listener
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            updateLanguage(e.target.value);
        });
    }

    nextBtn.addEventListener('click', () => {
        if (currentStep < steps.length - 1) {
            showStep(currentStep + 1);
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 0) {
            showStep(currentStep - 1);
        }
    });

    saveBtn.addEventListener('click', saveApiKey);

    // Initialize language and status on page load
    updateLanguage(currentLanguage);
    updateApiKeyStatus();
});

export {};
