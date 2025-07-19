export function setupFeedback(userRole) {
    const feedbackList = document.getElementById('feedback-list');

    async function loadFeedback() {
        try {
            const response = await fetch('/api/admin/feedback');
            if (!response.ok) {
                throw new Error('Failed to fetch feedback');
            }
            const feedbackData = await response.json();
            renderFeedback(feedbackData);
        } catch (error) {
            console.error('Error loading feedback:', error);
            feedbackList.innerHTML = '<p class="text-red-500">Error loading feedback.</p>';
        }
    }

    function renderFeedback(feedbackData) {
        if (!feedbackData || feedbackData.length === 0) {
            feedbackList.innerHTML = '<p>No feedback yet.</p>';
            return;
        }

        feedbackList.innerHTML = feedbackData.map(item => `
            <div class="p-4 bg-white rounded shadow-md">
                <p class="text-gray-800">${item.feedback_text}</p>
                <div class="text-sm text-gray-500 mt-2">
                    <span>${new Date(item.timestamp).toLocaleString()}</span>
                    ${item.email ? `| <span>Email: ${item.email}</span>` : ''}
                    ${item.conversation_id ? `| <span>Conversation ID: ${item.conversation_id}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    loadFeedback();
}
