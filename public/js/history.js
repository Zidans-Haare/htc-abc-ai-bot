import { CHAT_HISTORY_KEY } from './config.js';
import { renderChatHistory as renderHistoryUI } from './ui.js';

export function getChatHistory() {
    const history = localStorage.getItem(CHAT_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
}

function saveChatHistory(history) {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
}

export function deleteAllChats(app) {
    if (confirm("Möchten Sie wirklich alle Chatverläufe unwiderruflich löschen?")) {
        localStorage.removeItem(CHAT_HISTORY_KEY);
        renderHistoryUI([], null, () => app.loadChat(), () => app.closeMobileMenu());
        app.startNewChat();
        showToast("Alle Verläufe wurden gelöscht.");
    }
}

export function autoDeleteOldChats(settings) {
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
        return true; // Indicates history was changed
    }
    return false;
}

export function loadChat(id, app) {
    const history = getChatHistory();
    const chat = history.find(c => c.id === id);
    if (!chat) return;

    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    const suggestions = document.getElementById('prompt-suggestions');
    if (suggestions) {
        suggestions.style.display = 'none';
    }
    
    app.conversationId = chat.id;
    document.getElementById('messages').innerHTML = '';
    app.useFirstAvatar = true;

    chat.messages.forEach(msg => {
        app.addMessage(msg.text, msg.isUser, new Date(msg.timestamp), !msg.isUser, false);
    });
    
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-id') === id);
    });
}

export function saveMessageToHistory(conversationId, message, isUser, fullResponse) {
    const history = getChatHistory();
    let chat = history.find(c => c.id === conversationId);
    if (chat) {
        chat.messages.push({ text: message, isUser, timestamp: new Date().toISOString() });
    } else {
        history.push({
            id: conversationId,
            title: message.substring(0, 40) + (message.length > 40 ? '...' : ''),
            messages: [
                { text: message, isUser: true, timestamp: new Date().toISOString() },
                { text: fullResponse, isUser: false, timestamp: new Date().toISOString() }
            ]
        });
    }
    saveChatHistory(history);
}
