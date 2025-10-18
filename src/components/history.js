import { CHAT_HISTORY_KEY } from './config.js';

export function getChatHistory() {
    const history = localStorage.getItem(CHAT_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
}

function saveChatHistory(history) {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
}

export function getChatById(id) {
    const history = getChatHistory();
    return history.find(chat => chat.id === id);
}

export function deleteAllChats(app) {
    if (confirm("Möchten Sie wirklich alle Chatverläufe unwiderruflich löschen?")) {
        localStorage.removeItem(CHAT_HISTORY_KEY);
        app.startNewChat();
        return true;
    }
    return false;
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

    const userMessage = { text: message, isUser: true, timestamp: new Date().toISOString() };
    const aiMessage = { text: fullResponse, isUser: false, timestamp: new Date().toISOString() };

    if (chat) {
        // If chat exists, push both the new user message and the AI's response
        chat.messages.push(userMessage);
        chat.messages.push(aiMessage);
    } else {
        // If it's a new chat, create it with both messages and add it to the start of the history
        history.unshift({
            id: conversationId,
            title: message.substring(0, 40) + (message.length > 40 ? '...' : ''),
            messages: [
                userMessage,
                aiMessage
            ]
        });
    }
    saveChatHistory(history);
}

export function exportHistory() {
    const history = getChatHistory();
    if (history.length === 0) {
        showToast("Es gibt keinen Verlauf zum Exportieren.");
        return;
    }
    try {
        const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `htw-chat-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Verlauf wird heruntergeladen...");
    } catch (error) {
        console.error("Export failed:", error);
        showToast("Fehler beim Exportieren des Verlaufs.");
    }
}

export function importHistory(file, app) {
    if (!file) return Promise.resolve({ success: false, message: "No file provided" });
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const newHistory = JSON.parse(e.target.result);
                if (!Array.isArray(newHistory)) throw new Error("Ungültiges Dateiformat.");

                // Fix and validate imported chats
                const processedHistory = [];

                newHistory.forEach(chat => {
                    if (!chat.title || !Array.isArray(chat.messages)) {
                        console.log("Skipping invalid chat:", chat);
                        return;
                    }

                    // Fix null IDs
                    if (!chat.id) {
                        chat.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                    }

                    // Validate message structure - support both old and new formats
                    const hasValidMessages = chat.messages.every(msg => {
                        const hasOldFormat = msg.text !== undefined && msg.isUser !== undefined;
                        const hasNewFormat = msg.role !== undefined && msg.parts !== undefined;
                        return hasOldFormat || hasNewFormat;
                    });

                    if (hasValidMessages) {
                        processedHistory.push(chat);
                    }
                });

                const currentHistory = getChatHistory();
                const mergedHistory = [...currentHistory];
                let importedCount = 0;

                processedHistory.forEach(newChat => {
                    if (!currentHistory.some(existingChat => existingChat.id === newChat.id)) {
                        mergedHistory.push(newChat);
                        importedCount++;
                    }
                });

                if (importedCount === 0) {
                    resolve({ success: false, message: "Keine neuen Chats zum Importieren gefunden." });
                    return;
                }

                saveChatHistory(mergedHistory);
                resolve({ success: true, mergedHistory, importedCount, message: `${importedCount} Chat(s) erfolgreich importiert!` });
            } catch (error) {
                console.error("Failed to import history:", error);
                resolve({ success: false, message: `Fehler beim Importieren: ${error.message}` });
            }
        };
        reader.readAsText(file);
    });
}

// Missing functions that bot.js needs
export function getCurrentConversation() {
    const history = getChatHistory();
    return history.length > 0 ? history[0] : null;
}

export function startNewConversation() {
    return {
        id: Date.now().toString(),
        title: 'Neuer Chat',
        messages: []
    };
}

export function updateConversationTitle(conversationId, newTitle) {
    const history = getChatHistory();
    const chat = history.find(c => c.id === conversationId);
    if (chat) {
        chat.title = newTitle;
        saveChatHistory(history);
    }
}

export function deleteAllHistory() {
    localStorage.removeItem(CHAT_HISTORY_KEY);
}

export function saveHistory(conversation) {
    const history = getChatHistory();
    const existingIndex = history.findIndex(chat => chat.id === conversation.id);
    
    if (existingIndex !== -1) {
        history[existingIndex] = conversation;
    } else {
        history.unshift(conversation);
    }
    
    saveChatHistory(history);
}
