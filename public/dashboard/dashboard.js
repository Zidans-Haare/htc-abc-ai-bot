document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    fetchUnansweredQuestions();
    fetchFeedback();
});

async function fetchStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();
        renderStats(stats);
    } catch (error) {
        console.error('Fehler beim Abrufen der Statistiken:', error);
    }
}

async function fetchUnansweredQuestions() {
    try {
        const response = await fetch('/api/admin/unanswered');
        const questions = await response.json();
        renderUnansweredQuestions(questions);
    } catch (error) {
        console.error('Fehler beim Abrufen der unbeantworteten Fragen:', error);
    }
}

async function fetchFeedback() {
    try {
        const response = await fetch('/api/admin/feedback');
        const feedback = await response.json();
        renderFeedback(feedback);
    } catch (error) {
        console.error('Fehler beim Abrufen des Feedbacks:', error);
    }
}

function renderStats(stats) {
    const container = document.getElementById('stats-container');
    container.innerHTML = '';

    for (const key in stats) {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <h3>${key}</h3>
            <p>${stats[key]}</p>
        `;
        container.appendChild(card);
    }
}

function renderUnansweredQuestions(questions) {
    const container = document.getElementById('unanswered-questions-container');
    container.innerHTML = '';

    questions.forEach(question => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.innerHTML = `
            <h3>Frage ID: ${question.id}</h3>
            <p>${question.question}</p>
        `;
        container.appendChild(card);
    });
}

function renderFeedback(feedback) {
    const container = document.getElementById('feedback-container');
    container.innerHTML = '';

    feedback.forEach(item => {
        const card = document.createElement('div');
        card.className = 'feedback-card';
        card.innerHTML = `
            <h3>Feedback ID: ${item.id}</h3>
            <p>Rating: ${item.rating}</p>
            <p>${item.text}</p>
        `;
        container.appendChild(card);
    });
}