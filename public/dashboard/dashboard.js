document.addEventListener('DOMContentLoaded', () => {
    fetchKpis();
    fetchUnansweredQuestions();
    fetchRecentFeedback();
    fetchSessions();
    fetchMostViewedArticles();
    fetchFeedbackStats();
    fetchContentStats();
});

async function fetchKpis() {
    try {
        const response = await fetch('/api/dashboard/kpis');
        const kpis = await response.json();
        renderKpis(kpis);
    } catch (error) {
        console.error('Fehler beim Abrufen der KPIs:', error);
    }
}

async function fetchUnansweredQuestions() {
    try {
        const response = await fetch('/api/dashboard/unanswered-questions');
        const questions = await response.json();
        renderUnansweredQuestions(questions);
    } catch (error) {
        console.error('Fehler beim Abrufen der unbeantworteten Fragen:', error);
    }
}

async function fetchRecentFeedback() {
    try {
        const response = await fetch('/api/dashboard/recent-feedback');
        const feedback = await response.json();
        renderRecentFeedback(feedback);
    } catch (error) {
        console.error('Fehler beim Abrufen des Feedbacks:', error);
    }
}

async function fetchSessions() {
    try {
        const response = await fetch('/api/dashboard/sessions');
        const sessions = await response.json();
        renderSessionsChart(sessions);
    } catch (error) {
        console.error('Fehler beim Abrufen der Session-Daten:', error);
    }
}

function renderKpis(kpis) {
    const container = document.getElementById('kpi-container');
    container.innerHTML = '';

    const kpiCards = [
        { title: 'Gesamt-Sessions', value: kpis.totalSessions, icon: 'fa-users' },
        { title: 'Sessions heute', value: kpis.todaySessions, icon: 'fa-calendar-day' },
        { title: 'Erfolgsquote', value: `${kpis.successRate}%`, icon: 'fa-check-circle' },
        { title: 'Feedback-Score', value: `${kpis.feedbackScore}%`, icon: 'fa-star' },
        { title: 'Offene neue Fragen', value: kpis.openQuestions, icon: 'fa-question-circle' }
    ];

    kpiCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'bg-white p-6 rounded-lg shadow';
        cardElement.innerHTML = `
            <div class="flex items-center">
                <div class="bg-gray-200 rounded-full p-3">
                    <i class="fas ${card.icon} text-2xl text-gray-600"></i>
                </div>
                <div class="ml-4">
                    <h3 class="text-lg font-semibold text-gray-700">${card.title}</h3>
                    <p class="text-2xl font-bold text-gray-900">${card.value}</p>
                </div>
            </div>
        `;
        container.appendChild(cardElement);
    });
}

function renderUnansweredQuestions(questions) {
    const container = document.getElementById('unanswered-questions-container');
    container.innerHTML = '';

    if (questions.length === 0) {
        container.innerHTML = '<p>Keine unbeantworteten Fragen gefunden.</p>';
        return;
    }

    questions.forEach(question => {
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow flex justify-between items-center';
        card.innerHTML = `
            <p class="text-gray-800">${question.question}</p>
            <p class="text-lg font-bold text-gray-900">${question.count}</p>
        `;
        container.appendChild(card);
    });
}

function renderRecentFeedback(feedback) {
    const container = document.getElementById('feedback-container');
    container.innerHTML = '';

    if (feedback.length === 0) {
        container.innerHTML = '<p>Kein Feedback gefunden.</p>';
        return;
    }

    feedback.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow';
        card.innerHTML = `
            <p class="text-gray-800">${item.feedback_text}</p>
            <p class="text-sm text-gray-500 mt-2">Rating: ${item.rating}</p>
        `;
        container.appendChild(card);
    });
}

function renderSessionsChart(sessions) {
    const ctx = document.getElementById('sessions-chart').getContext('2d');
    
    const labels = sessions.map(s => s.date);
    const data = sessions.map(s => s.count);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sessions',
                data: data,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function fetchMostViewedArticles() {
    try {
        const response = await fetch('/api/dashboard/most-viewed-articles');
        const articles = await response.json();
        renderMostViewedArticles(articles);
    } catch (error) {
        console.error('Fehler beim Abrufen der meistaufgerufenen Artikel:', error);
    }
}

function renderMostViewedArticles(articles) {
    const container = document.getElementById('most-viewed-articles-container');
    container.innerHTML = '';

    if (articles.length === 0) {
        container.innerHTML = '<p>Keine Artikel gefunden.</p>';
        return;
    }

    articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow flex justify-between items-center';
        card.innerHTML = `
            <p class="text-gray-800">${article.headline}</p>
            <p class="text-lg font-bold text-gray-900">${article.views}</p>
        `;
        container.appendChild(card);
    });
}

async function fetchFeedbackStats() {
    try {
        const response = await fetch('/api/dashboard/feedback-stats');
        const stats = await response.json();
        renderFeedbackStats(stats);
        renderFeedbackChart(stats.feedbackOverTime);
    } catch (error) {
        console.error('Fehler beim Abrufen der Feedback-Statistiken:', error);
    }
}

function renderFeedbackStats(stats) {
    const container = document.getElementById('feedback-stats-container');
    container.innerHTML = `
        <div class="flex justify-between items-center">
            <p class="text-gray-800">Positives Feedback</p>
            <p class="text-lg font-bold text-green-500">${stats.positiveFeedback}</p>
        </div>
        <div class="flex justify-between items-center mt-2">
            <p class="text-gray-800">Negatives Feedback</p>
            <p class="text-lg font-bold text-red-500">${stats.negativeFeedback}</p>
        </div>
    `;
}

function renderFeedbackChart(feedback) {
    const ctx = document.getElementById('feedback-chart').getContext('2d');
    
    const labels = feedback.map(f => f.date);
    const data = feedback.map(f => f.count);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Feedback',
                data: data,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function fetchContentStats() {
    try {
        const response = await fetch('/api/dashboard/content-stats');
        const stats = await response.json();
        renderContentStats(stats);
    } catch (error) {
        console.error('Fehler beim Abrufen der Content-Statistiken:', error);
    }
}

function renderContentStats(stats) {
    const container = document.getElementById('content-stats-container');
    container.innerHTML = `
        <div class="flex justify-between items-center">
            <p class="text-gray-800">Aktive Artikel</p>
            <p class="text-lg font-bold text-gray-900">${stats.activeArticles}</p>
        </div>
        <div class="flex justify-between items-center mt-2">
            <p class="text-gray-800">Archivierte Artikel</p>
            <p class="text-lg font-bold text-gray-900">${stats.archivedArticles}</p>
        </div>
        <h3 class="text-lg font-semibold mt-4">Top Editors</h3>
        <div class="space-y-2 mt-2">
            ${stats.topEditors.map(editor => `
                <div class="flex justify-between items-center">
                    <p class="text-gray-800">${editor.editor}</p>
                    <p class="text-lg font-bold text-gray-900">${editor.count}</p>
                </div>
            `).join('')}
        </div>
    `;
}
