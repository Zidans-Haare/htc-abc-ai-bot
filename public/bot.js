document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const currentTimeEl = document.getElementById('current-time');
    const messagesEl = document.getElementById('messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtnEl = document.getElementById('send-btn');
    const typingEl = document.getElementById('typing');
    const scrollBtnEl = document.getElementById('scroll-btn');
    let conversationId = null;

    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const closeSettings = document.getElementById("close-settings");
    const accentColorInput = document.getElementById("accent-color");

    // --- NEU: Hier definieren wir die beiden Bilder für den Avatar-Wechsel ---
    const botAvatarImage1 = '/image/smoky_klein.png'; // Ersetze dies bei Bedarf
    const botAvatarImage2 = '/image/stu_klein.png'; // Ersetze dies bei Bedarf
    let useFirstAvatar = true; // Dieser "Schalter" entscheidet, welches Bild als nächstes kommt

    // Uhrzeit aktualisieren
    function updateClock() {
        if (currentTimeEl) {
            currentTimeEl.textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        }
    }
    setInterval(updateClock, 1000);
    updateClock();
    
    // Wir setzen den Startwert des Color-Pickers auf den CSS-Standard.
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
    function addMsg(text, isUser, timestamp, copyable = false) {
        const m = document.createElement('div');
        m.className = `message ${isUser ? 'user' : 'ai'}`;

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        
        // --- KORREKTUR: Logik für den Avatar-Wechsel ---
        if (isUser) {
            // Avatar für den Nutzer
            avatar.innerHTML = `<i class="fas fa-user"></i>`;
        } else {
            // Avatar für den Bot (wechselt bei jeder Nachricht)
            const avatarSrc = useFirstAvatar ? botAvatarImage1 : botAvatarImage2;
            avatar.innerHTML = `<img src="${avatarSrc}" alt="Bot Avatar" />`;
            
            // Den Schalter für die nächste Nachricht umlegen
            useFirstAvatar = !useFirstAvatar;
        }
        m.appendChild(avatar);

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
    
        let formattedText = text.replace(/\n/g, '<br>');
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
    }

    // Neuer Chat
    document.getElementById('new-chat').addEventListener('click', () => {
        messagesEl.innerHTML = '';
        conversationId = null;
        // Setzt den Avatar-Schalter zurück, damit jeder neue Chat mit dem ersten Bild beginnt
        useFirstAvatar = true; 
        addMsg('Neues Gespräch gestartet. Wie kann ich helfen?', false, new Date());
    });

    // Nachricht senden
    async function sendMsg(prefilled) {
        const txt = prefilled || chatInput.value.trim();
        if (!txt) return;
        addMsg(txt, true, new Date());
        chatInput.value = '';
        chatInput.style.height = 'auto';
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
            conversationId = data.conversationId;
            addMsg(data.response, false, new Date(), true);
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

    // Startnachricht
    addMsg('Hallo! Ich bin Alex, dein AI-Assistent der HTW Dresden. Wie kann ich dir helfen?', false, new Date());
});