document.addEventListener('DOMContentLoaded', () => {
   const root = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');
    const currentTimeEl = document.getElementById('current-time');
    const messagesEl = document.getElementById('messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtnEl = document.getElementById('send-btn');
    const typingEl = document.getElementById('typing');
    const scrollBtnEl = document.getElementById('scroll-btn');
    const suggestionChips = document.querySelectorAll('.chip');
    let conversationId = null;

    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const closeSettings = document.getElementById("close-settings");
    const accentColorInput = document.getElementById("accent-color");
    // Update clock every minute
    function updateClock() {
      currentTimeEl.textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Theme toggle
    themeToggle.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
    const saved = localStorage.getItem('theme');
    if (saved) root.setAttribute('data-theme', saved);

    // Scroll handling
    const savedAccent = localStorage.getItem("accent");
    if (savedAccent) {
      root.style.setProperty("--accent", savedAccent);
      accentColorInput.value = savedAccent;
    }
    settingsBtn.addEventListener("click", () => settingsModal.classList.add("open"));
    closeSettings.addEventListener("click", () => settingsModal.classList.remove("open"));
    settingsModal.addEventListener("click", e => { if (e.target === settingsModal) settingsModal.classList.remove("open"); });
    accentColorInput.addEventListener("input", () => {
      root.style.setProperty("--accent", accentColorInput.value);
      localStorage.setItem("accent", accentColorInput.value);
    });
    function scrollToBottom() {
      scrollBtnEl.style.display = 'none';
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    messagesEl.addEventListener('scroll', () => {
      const distance = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
      scrollBtnEl.style.display = distance > 100 ? 'block' : 'none';
    });
    scrollBtnEl.addEventListener('click', scrollToBottom);

    // Auto-resize input
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = `${chatInput.scrollHeight}px`;
    });

    // Add a message to the chat
    function addMsg(text, isUser, timestamp, copyable = false) {
      const m = document.createElement('div');
      m.className = `message ${isUser ? 'user' : 'ai'}`;

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.innerHTML = `<i class="fas ${isUser ? 'fa-user' : 'fa-robot'}"></i>`;
      m.appendChild(avatar);

      const bubble = document.createElement('div');
      bubble.className = 'bubble';
	  
	  // Convert plain text to HTML if it contains markup-like formatting
      let formattedText = text;
      if (!isUser) {
        formattedText = formattedText
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/^\s*-\s*(.*)$/gm, '<li>$1</li>')
          .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')
          .replace(/^##\s*(.*)$/gm, '<h2>$1</h2>')
          .replace(/^#\s*(.*)$/gm, '<h1>$1</h1>')
		  .replace(/\n/g, '<br>');
      }
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


    // New chat handler
    document.getElementById('new-chat').addEventListener('click', () => {
      messagesEl.innerHTML = '';
      conversationId = null;
      addMsg('Neues Gespräch gestartet. Wie kann ich helfen?', false, new Date());
    });

    // Send message logic
    async function sendMsg(prefilled) {
      const txt = prefilled || chatInput.value.trim();
      if (!txt) return;
      addMsg(txt, true, new Date());
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
        conversationId = data.conversationId;
        addMsg(data.response, false, new Date(), true);
      } catch (e) {
        addMsg('Fehler beim Server.', false);
        console.error(e);
      } finally {
        typingEl.style.display = 'none';
        chatInput.disabled = false;
        sendBtnEl.disabled = false;
        chatInput.focus();
      }
    }

    // Event listeners
    sendBtnEl.addEventListener('click', () => sendMsg());
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });
    suggestionChips.forEach(c => c.addEventListener('click', () => sendMsg(c.textContent)));

    // Initial setup
    addMsg('Hallo! Ich bin Alex, dein AI-Assistent der HTW Dresden. Wie kann ich dir helfen?', false, new Date());
	
	
});

