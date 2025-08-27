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

    let currentStep = 0;

    const API_KEY_STORAGE_ITEM = 'user_api_key';

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

    function saveApiKey() {
        const key = apiKeyInput.value.trim();
        if (key.length < 10) { // Basic validation
            apiKeyError.textContent = 'Bitte gib einen gültigen API-Schlüssel ein.';
            return;
        }
        
        localStorage.setItem(API_KEY_STORAGE_ITEM, key);
        apiKeyError.textContent = '';
        updateApiKeyStatus();
        closeModal();
        // Optional: Show a success toast
        window.showToast('API-Schlüssel erfolgreich gespeichert!');
    }

    function updateApiKeyStatus() {
        const storedKey = localStorage.getItem(API_KEY_STORAGE_ITEM);
        if (storedKey) {
            apiKeyStatus.textContent = 'Konfiguriert';
            apiKeyStatus.classList.add('configured');
            openBtn.textContent = 'Ändern';
        } else {
            apiKeyStatus.textContent = 'Nicht konfiguriert';
            apiKeyStatus.classList.remove('configured');
            openBtn.textContent = 'Konfigurieren & Limits aufheben';
        }
    }

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

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

    // Initialize status on page load
    updateApiKeyStatus();
});
