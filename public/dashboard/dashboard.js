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

async function fetchMostViewedArticles() {
    try {
        const response = await fetch('/api/dashboard/most-viewed-articles');
        const articles = await response.json();
        renderMostViewedArticles(articles);
    } catch (error) {
        console.error('Fehler beim Abrufen der meistbesuchten Artikel:', error);
    }
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

async function fetchContentStats() {
    try {
        const response = await fetch('/api/dashboard/content-stats');
        const stats = await response.json();
        renderContentStats(stats);
    } catch (error) {
        console.error('Fehler beim Abrufen der Content-Statistiken:', error);
    }
}

function renderKpis(kpis) {
    const container = document.getElementById('kpi-container');
    container.innerHTML = `
        <!-- Gesamt Sessions -->
        <div class="bg-white p-6 rounded-lg shadow">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <i class="fas fa-users text-white text-sm"></i>
                    </div>
                </div>
                <div class="ml-4">
                    <p class="text-sm font-medium text-gray-500">Gesamt Sessions</p>
                    <p class="text-2xl font-bold text-gray-900">${kpis.totalSessions || 0}</p>
                </div>
            </div>
        </div>

        <!-- Sessions Heute -->
        <div class="bg-white p-6 rounded-lg shadow">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <i class="fas fa-calendar-day text-white text-sm"></i>
                    </div>
                </div>
                <div class="ml-4">
                    <p class="text-sm font-medium text-gray-500">Sessions Heute</p>
                    <p class="text-2xl font-bold text-gray-900">${kpis.todaySessions || 0}</p>
                </div>
            </div>
        </div>

        <!-- Erfolgsrate -->
        <div class="bg-white p-6 rounded-lg shadow">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                        <i class="fas fa-chart-line text-white text-sm"></i>
                    </div>
                </div>
                <div class="ml-4">
                    <p class="text-sm font-medium text-gray-500">Erfolgsrate</p>
                    <p class="text-2xl font-bold text-gray-900">${kpis.successRate}%</p>
                </div>
            </div>
        </div>

        <!-- Offene Fragen -->
        <div class="bg-white p-6 rounded-lg shadow">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                        <i class="fas fa-question-circle text-white text-sm"></i>
                    </div>
                </div>
                <div class="ml-4">
                    <p class="text-sm font-medium text-gray-500">Offene Fragen</p>
                    <p class="text-2xl font-bold text-gray-900">${kpis.openQuestions || 0}</p>
                </div>
            </div>
        </div>
    `;
}

function renderUnansweredQuestions(questions) {
    const container = document.getElementById('unanswered-questions-container');
    container.innerHTML = '';

    if (questions.length === 0) {
        container.innerHTML = '<p>Keine unbeantworteten Fragen gefunden.</p>';
        return;
    }

    questions.forEach(questionGroup => {
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow';
        
        // Show similar questions if available
        const similarInfo = questionGroup.similar_questions && questionGroup.similar_questions.length > 1 
            ? `<p class="text-sm text-gray-500 mt-2">Ähnliche Fragen: ${questionGroup.similar_questions.slice(1).join(', ')}</p>`
            : '';
        
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <p class="text-gray-800 font-medium">${questionGroup.question}</p>
                    ${similarInfo}
                </div>
                <span class="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full ml-2">${questionGroup.count}</span>
            </div>
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
                borderColor: 'rgba(59, 130, 246, 1)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
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

function renderContentStats(stats) {
    const container = document.getElementById('content-stats-container');
    container.innerHTML = `
        <div class="flex justify-between items-center">
            <p class="text-gray-800">Aktive Artikel</p>
            <p class="text-lg font-bold text-green-500">${stats.activeArticles}</p>
        </div>
        <div class="flex justify-between items-center mt-2">
            <p class="text-gray-800">Archivierte Artikel</p>
            <p class="text-lg font-bold text-gray-500">${stats.archivedArticles}</p>
        </div>
    `;
}

function renderRecentFeedback(feedback) {
    const container = document.getElementById('recent-feedback-container');
    container.innerHTML = '';

    if (feedback.length === 0) {
        container.innerHTML = '<p>Kein Feedback vorhanden.</p>';
        return;
    }

    feedback.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow';
        card.innerHTML = `
            <p class="text-gray-800 text-sm mb-2">${item.feedback_text.substring(0, 100)}...</p>
            <p class="text-gray-500 text-xs">${new Date(item.timestamp).toLocaleDateString('de-DE')}</p>
        `;
        container.appendChild(card);
    });
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
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}