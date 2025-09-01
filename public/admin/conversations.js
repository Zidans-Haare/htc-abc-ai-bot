// conversations.js - im alten Stil, ohne Module

let allConversations = [];
let currentFilter = 'All';

const CATEGORIES = [
    "All", "Unkategorisiert", "Immatrikulation & Bewerbung", "Prüfungen & Noten", 
    "Bibliothek & Ressourcen", "Campus-Leben & Mensa", "Organisation & Verwaltung", 
    "Technischer Support & IT", "Internationales & Auslandssemester", "Feedback zum Bot", "Sonstiges & Unklares"
];

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
        allConversations = await response.json();
        renderFilterButtons();
        renderConversations();
    } catch (error) {
        console.error('Error fetching conversations:', error);
    }
}

async function fetchAndDisplayMessages(conversationId) {
    renderConversations(conversationId); // Re-render to show selection

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

function renderFilterButtons() {
    const filterContainer = document.getElementById('conversation-filter-container');
    if (!filterContainer) return;

    filterContainer.innerHTML = '';
    CATEGORIES.forEach(category => {
        const button = document.createElement('button');
        button.textContent = category;
        button.className = `px-2 py-1 text-xs rounded-md border ${currentFilter === category ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`;
        button.addEventListener('click', () => {
            currentFilter = category;
            renderFilterButtons();
            renderConversations();
        });
        filterContainer.appendChild(button);
    });
}

function renderConversations(selectedConversationId) {
    const listContainer = document.getElementById('conversations-list');
    if (!listContainer) return;

    const filteredConversations = allConversations.filter(c => 
        currentFilter === 'All' || c.category === currentFilter
    );

    listContainer.innerHTML = '';
    filteredConversations.forEach(conv => {
        const div = document.createElement('div');
        div.className = `p-3 rounded-lg cursor-pointer border ${selectedConversationId === conv.id ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'}`;
        
        const date = new Date(conv.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
        const categoryTag = conv.category ? `<span class="text-xs font-semibold px-2 py-1 bg-gray-200 text-gray-700 rounded-full">${conv.category}</span>` : '';

        div.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-semibold text-sm">ID: ${conv.id.substring(0, 8)}...</p>
                    <p class="text-xs text-gray-500">User: ${conv.anonymous_user_id.substring(0, 8)}...</p>
                    <p class="text-xs text-gray-500 mt-1">${date}</p>
                </div>
                ${categoryTag}
            </div>
        `;
        div.addEventListener('click', () => fetchAndDisplayMessages(conv.id));
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
        
        const content = document.createElement('div');
        // content.textContent = msg.content; // OLD
        if (isUser) {
            content.textContent = msg.content;
        } else {
            // For bot messages, parse markdown and sanitize
            content.innerHTML = DOMPurify.sanitize(marked.parse(msg.content));
            content.querySelectorAll('img').forEach(img => {
                img.classList.add('max-w-full', 'h-auto', 'rounded-lg', 'mt-2');
            });
        }
        
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