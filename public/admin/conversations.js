// conversations.js - im alten Stil, ohne Module

window.initConversations = function(showConversationsCallback) {
    const conversationsNav = document.getElementById('btn-conversations');
    if (conversationsNav) {
        conversationsNav.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof showConversationsCallback === 'function') {
                showConversationsCallback();
            }
            fetchConversations();
        });
    }
}

async function fetchConversations() {
    try {
        const response = await fetch('/api/admin/conversations');
        if (!response.ok) throw new Error('Failed to fetch conversations');
        const conversations = await response.json();
        renderConversations(conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        // Hier könnten Sie eine Toast-Nachricht anzeigen, wenn Sie eine globale Funktion dafür haben
    }
}

async function fetchAndDisplayMessages(conversationId, conversations) {
    renderConversations(conversations, conversationId); // Re-render to show selection

    const messagesContainer = document.getElementById('conversation-detail-messages');
    const titleContainer = document.getElementById('conversation-detail-title');
    messagesContainer.innerHTML = '<p>Loading messages...</p>';
    titleContainer.textContent = `Conversation ${conversationId.substring(0, 8)}...`;

    try {
        const response = await fetch(`/api/admin/conversations/${conversationId}`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        const messages = await response.json();
        renderMessages(messages);
    } catch (error) {
        console.error(`Error fetching messages for ${conversationId}:`, error);
        messagesContainer.innerHTML = '<p class="text-red-500">Failed to load messages.</p>';
    }
}

function renderConversations(conversations, selectedConversationId) {
    const listContainer = document.getElementById('conversations-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    conversations.forEach(conv => {
        const div = document.createElement('div');
        div.className = `p-3 rounded-lg cursor-pointer border ${selectedConversationId === conv.id ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'}`;
        
        const date = new Date(conv.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });

        div.innerHTML = `
            <p class="font-semibold text-sm">ID: ${conv.id.substring(0, 8)}...</p>
            <p class="text-xs text-gray-500">User: ${conv.anonymous_user_id.substring(0, 8)}...</p>
            <p class="text-xs text-gray-500 mt-1">${date}</p>
        `;
        div.addEventListener('click', () => fetchAndDisplayMessages(conv.id, conversations));
        listContainer.appendChild(div);
    });
}

function renderMessages(messages) {
    const messagesContainer = document.getElementById('conversation-detail-messages');
    messagesContainer.innerHTML = '';
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<p>No messages in this conversation.</p>';
        return;
    }

    messages.forEach(msg => {
        const bubble = document.createElement('div');
        const isUser = msg.role === 'user';
        
        const content = document.createElement('p');
        content.textContent = msg.content;
        
        const timestamp = document.createElement('p');
        timestamp.className = 'text-xs mt-1';
        timestamp.textContent = new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        bubble.className = 'p-3 rounded-lg max-w-xl';
        bubble.appendChild(content);
        bubble.appendChild(timestamp);

        if (isUser) {
            bubble.style.backgroundColor = 'var(--accent-color)';
            bubble.classList.add('text-white');
            timestamp.classList.add('text-gray-200');
        } else {
            bubble.classList.add('bg-gray-200', 'text-gray-800');
            timestamp.classList.add('text-gray-500');
        }
        
        const wrapper = document.createElement('div');
        wrapper.className = `flex mb-2 ${isUser ? 'justify-end' : 'justify-start'}`;
        wrapper.appendChild(bubble);

        messagesContainer.appendChild(wrapper);
    });
}
