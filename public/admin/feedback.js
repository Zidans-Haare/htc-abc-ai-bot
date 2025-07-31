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
            <div class="p-4 bg-white rounded shadow-md mb-4" data-id="${item.id}">
                <div class="flex justify-between items-start">
                    <div class="flex-grow">
                        <p class="text-gray-800">${item.feedback_text}</p>
                        <div class="text-sm text-gray-500 mt-2">
                            <span>${new Date(item.timestamp).toLocaleString()}</span>
                            ${item.email ? `| <span>Email: ${item.email}</span>` : ''}
                            ${item.conversation_id ? `| <span>Conversation ID: ${item.conversation_id}</span>` : ''}
                        </div>
                    </div>
                    <button class="delete-feedback-btn text-red-500 hover:text-red-700 ml-4">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                ${item.attached_chat_history ? `
                    <details class="mt-4">
                        <summary class="cursor-pointer text-blue-600 hover:underline">Angehängten Chat-Verlauf anzeigen</summary>
                        <pre class="mt-2 p-2 bg-gray-100 rounded text-sm whitespace-pre-wrap">${item.attached_chat_history}</pre>
                    </details>
                ` : ''}
            </div>
        `).join('');

        document.querySelectorAll('.delete-feedback-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const feedbackDiv = e.target.closest('[data-id]');
                const id = feedbackDiv.dataset.id;
                
                if (confirm('Soll dieser Feedback-Eintrag wirklich gelöscht werden?')) {
                    try {
                        const response = await fetch(`/api/admin/feedback/${id}`, {
                            method: 'DELETE'
                        });

                        if (response.ok) {
                            feedbackDiv.remove();
                        } else {
                            alert('Löschen fehlgeschlagen.');
                        }
                    } catch (error) {
                        console.error('Error deleting feedback:', error);
                        alert('Fehler beim Löschen.');
                    }
                }
            });
        });
    }

    loadFeedback();
}
