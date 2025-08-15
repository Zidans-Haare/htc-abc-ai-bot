class DashboardManager {
    constructor() {
        this.charts = {};
        this.refreshInterval = null;
        this.init();
    }

    async init() {
        await this.loadDashboard();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        const refreshButton = document.getElementById('refresh-btn');
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');
        const refreshButtonMobile = document.getElementById('refresh-btn-mobile');

        const handleRefresh = () => {
            this.loadDashboard();

            // Disable buttons and start cooldown
            const buttons = [refreshButton, refreshButtonMobile];
            buttons.forEach(button => {
                if (button) {
                    button.disabled = true;
                    button.classList.add('bg-gray-400', 'cursor-not-allowed');
                    button.classList.remove('bg-orange-600', 'hover:bg-orange-700');
                }
            });

            let countdown = 60;
            const updateButtonText = () => {
                buttons.forEach(button => {
                    if (button) {
                        button.innerHTML = `<i class="fas fa-clock mr-2"></i>Bitte warten (${countdown}s)`;
                    }
                });
            };

            updateButtonText();

            const interval = setInterval(() => {
                countdown--;
                updateButtonText();
                if (countdown <= 0) {
                    clearInterval(interval);
                    buttons.forEach(button => {
                        if (button) {
                            button.disabled = false;
                            button.innerHTML = '<i class="fas fa-refresh mr-2"></i>Aktualisieren';
                            button.classList.remove('bg-gray-400', 'cursor-not-allowed');
                            button.classList.add('bg-orange-600', 'hover:bg-orange-700');
                        }
                    });
                }
            }, 1000);
        };

        if (refreshButton) {
            refreshButton.addEventListener('click', handleRefresh);
        }
        if (refreshButtonMobile) {
            refreshButtonMobile.addEventListener('click', handleRefresh);
        }

        if (mobileMenuButton && mobileMenu) {
            mobileMenuButton.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }

        // Auto-refresh every 2 minutes
        this.startAutoRefresh();
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            this.loadDashboard(false); // Silent refresh
        }, 120000); // Refresh every 2 minutes (120 seconds)
    }

    async loadDashboard(showLoading = true) {
        try {
            if (showLoading) {
                this.showLoading();
            }

            // Load all data in parallel
            const [kpis, unansweredQuestions, recentFeedback, sessions, mostViewedArticles, feedbackStats, contentStats, topQuestions] = await Promise.all([
                this.fetchKpis(),
                this.fetchUnansweredQuestions(),
                this.fetchRecentFeedback(),
                this.fetchSessions(),
                this.fetchMostViewedArticles(),
                this.fetchFeedbackStats(),
                this.fetchContentStats(),
                this.fetchTopQuestions()
            ]);

            // Render all components
            this.renderKpis(kpis);
            this.renderUnansweredQuestions(unansweredQuestions);
            this.renderRecentFeedback(recentFeedback);
            this.renderSessionsChart(sessions);
            this.renderMostViewedArticles(mostViewedArticles);
            this.renderFeedbackStats(feedbackStats);
            this.renderContentStats(contentStats);
            this.renderTopQuestions(topQuestions);

            this.updateLastRefresh();
            this.hideLoading();

        } catch (error) {
            console.error('❌ Fehler beim Laden des Dashboards:', error);
            
            // Check if it's a session error
            if (error.message.includes('401') || error.message.includes('Session expired')) {
                this.showError('Session abgelaufen. Seite wird neu geladen...', 'warning');
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                this.showError('Zu viele Anfragen. Auto-Refresh pausiert für 5 Minuten.', 'warning');
                // Pause auto-refresh for 5 minutes
                if (this.refreshInterval) {
                    clearInterval(this.refreshInterval);
                    setTimeout(() => {
                        this.startAutoRefresh();
                    }, 300000); // 5 minutes
                }
            } else {
                this.showError('Fehler beim Laden der Dashboard-Daten. Bitte versuchen Sie es später erneut.');
            }
            this.hideLoading();
        }
    }

    // API Fetch Methods
    async fetchKpis() {
        const response = await fetch('/api/dashboard/kpis');
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('429 Too Many Requests');
            }
            throw new Error('KPI fetch failed');
        }
        return response.json();
    }

    async fetchUnansweredQuestions() {
        const response = await fetch('/api/dashboard/unanswered-questions');
        if (!response.ok) throw new Error('Unanswered questions fetch failed');
        return response.json();
    }

    async fetchRecentFeedback() {
        const response = await fetch('/api/dashboard/recent-feedback');
        if (!response.ok) throw new Error('Recent feedback fetch failed');
        return response.json();
    }

    async fetchSessions() {
        const response = await fetch('/api/dashboard/sessions');
        if (!response.ok) throw new Error('Sessions fetch failed');
        return response.json();
    }

    async fetchMostViewedArticles() {
        const response = await fetch('/api/dashboard/most-viewed-articles');
        if (!response.ok) throw new Error('Most viewed articles fetch failed');
        return response.json();
    }

    async fetchFeedbackStats() {
        const response = await fetch('/api/dashboard/feedback-stats');
        if (!response.ok) throw new Error('Feedback stats fetch failed');
        return response.json();
    }

    async fetchContentStats() {
        const response = await fetch('/api/dashboard/content-stats');
        if (!response.ok) throw new Error('Content stats fetch failed');
        return response.json();
    }

    async fetchTopQuestions() {
        const response = await fetch('/api/dashboard/top-questions');
        if (!response.ok) throw new Error('Top questions fetch failed');
        return response.json();
    }

    // Render Methods
    renderKpis(kpis) {
        document.getElementById('total-sessions').textContent = kpis.totalSessions || 0;
        document.getElementById('today-sessions').textContent = kpis.todaySessions || 0;
        document.getElementById('success-rate').textContent = `${kpis.successRate || 0}%`;
        document.getElementById('open-questions').textContent = kpis.openQuestions || 0;
    }

    renderUnansweredQuestions(questions) {
        const container = document.getElementById('unanswered-questions');
        
        
        if (!questions || questions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle text-green-500 text-3xl mb-3"></i>
                    <p class="font-semibold">Keine unbeantworteten Fragen gefunden!</p>
                    <p class="text-sm">Alle Fragen wurden erfolgreich beantwortet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = questions.map((q, index) => `
            <div class="question-item">
                <div class="flex justify-between items-start">
                    <div class="flex items-start space-x-3 flex-1">
                        <div class="bg-orange-100 text-orange-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            ${index + 1}
                        </div>
                        <div class="flex-1">
                            <p class="text-gray-800 font-medium leading-relaxed">${this.escapeHtml(q.question)}</p>
                            ${q.similar_questions && q.similar_questions.length > 1 ? 
                                `<div class="mt-2">
                                    <p class="text-xs text-gray-400 mb-1">Ähnliche Varianten:</p>
                                    <div class="text-xs text-gray-600 space-y-1">
                                        ${q.similar_questions.slice(0, 3).map(sq => 
                                            `<div class="bg-gray-50 px-2 py-1 rounded">${this.escapeHtml(sq)}</div>`
                                        ).join('')}
                                        ${q.similar_questions.length > 3 ? 
                                            `<div class="text-xs text-gray-400">... und ${q.similar_questions.length - 3} weitere</div>` : ''
                                        }
                                    </div>
                                </div>` : ''
                            }
                        </div>
                    </div>
                    <div class="flex flex-col items-center ml-3">
                        <span class="question-badge">${q.count}×</span>
                        <span class="text-xs text-gray-400 mt-1">mal gefragt</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderRecentFeedback(feedback) {
        const container = document.getElementById('recent-feedback');
        
        if (!feedback || feedback.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment-slash text-gray-400"></i>
                    <p>Noch kein Feedback vorhanden</p>
                </div>
            `;
            return;
        }

        container.innerHTML = feedback.map(item => `
            <div class="feedback-item">
                <p class="text-gray-700 text-sm mb-2 leading-relaxed">
                    ${this.truncateText(this.escapeHtml(item.feedback_text), 150)}
                </p>
                <div class="flex justify-between items-center text-xs text-gray-500">
                    <span>${this.formatDate(item.timestamp)}</span>
                    <i class="fas fa-quote-right opacity-50"></i>
                </div>
            </div>
        `).join('');
    }

    renderSessionsChart(sessions) {
        const container = document.getElementById('sessions-bars');
        
        if (!sessions || sessions.length === 0) {
            container.innerHTML = `
                <div class="text-gray-500 text-center w-full">
                    <i class="fas fa-chart-bar text-4xl mb-4 opacity-50"></i>
                    <p>Keine Session-Daten der letzten 7 Tage</p>
                    <p class="text-sm">Starte ein paar Chat-Sessions um Daten zu sammeln!</p>
                </div>
            `;
            return;
        }

        const maxCount = Math.max(...sessions.map(s => s.count), 1);
        
        container.innerHTML = sessions.map((session, index) => {
            const percentage = maxCount > 0 ? (session.count / maxCount) * 100 : 0;
            const height = Math.max(percentage, session.count > 0 ? 15 : 5); // Minimum height for data
            const isToday = new Date(session.date).toDateString() === new Date().toDateString();
            
            return `
                <div class="flex flex-col items-center flex-1 group relative">
                    <!-- Value label -->
                    <div class="text-xs font-bold text-gray-800 mb-1 ${session.count === 0 ? 'text-gray-400' : ''}">${session.count}</div>
                    
                    <!-- Bar -->
                    <div class="relative w-12 flex flex-col justify-end bg-gray-100 rounded-lg overflow-hidden shadow-inner" 
                         style="height: 120px;" 
                         title="${this.formatDateShort(session.date)}: ${session.count} Aktivitäten">
                        <div class="w-full ${session.count === 0 ? 'bg-gray-300' : 'bg-gradient-to-t from-orange-600 via-orange-500 to-orange-400'} 
                                    transition-all duration-500 ease-out hover:brightness-110 rounded-t-lg" 
                             style="height: ${height}%;">
                        </div>
                        ${isToday ? '<div class="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>' : ''}
                    </div>
                    
                    <!-- Date label -->
                    <div class="text-xs text-gray-600 mt-2 font-medium ${isToday ? 'text-green-700 font-bold' : ''}">
                        ${isToday ? 'Heute' : this.formatDateShort(session.date)}
                    </div>
                    
                    <!-- Hover effect -->
                    <div class="absolute inset-0 bg-orange-100 opacity-0 group-hover:opacity-20 transition-opacity duration-200 rounded-lg"></div>
                </div>
            `;
        }).join('');
    }

    renderMostViewedArticles(articles) {
        const container = document.getElementById('most-viewed-articles');
        
        if (!articles || articles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt text-gray-400"></i>
                    <p>Noch keine Artikel-Aufrufe</p>
                </div>
            `;
            return;
        }

        container.innerHTML = articles.map((article, index) => `
            <div class="article-item">
                <div class="flex items-center">
                    <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                        ${index + 1}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-gray-900 font-medium truncate">${this.escapeHtml(article.headline)}</p>
                    </div>
                </div>
                <span class="article-views">${article.views} Views</span>
            </div>
        `).join('');
    }

    renderFeedbackStats(stats) {
        document.getElementById('positive-feedback').textContent = stats.positiveFeedback || 0;
        document.getElementById('negative-feedback').textContent = stats.negativeFeedback || 0;
    }

    renderContentStats(stats) {
        document.getElementById('active-articles').textContent = stats.activeArticles || 0;
        document.getElementById('archived-articles').textContent = stats.archivedArticles || 0;
    }

    renderTopQuestions(questions) {
        const container = document.getElementById('top-questions');
        
        
        if (!questions || questions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments text-blue-500 text-3xl mb-3"></i>
                    <p class="font-semibold">Noch keine Fragen gestellt!</p>
                    <p class="text-sm">Sobald Nutzer Fragen stellen, erscheinen hier die häufigsten.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = questions.map((q, index) => `
            <div class="question-item ${q.is_answered ? 'border-green-200 bg-green-50' : 'border-gray-200'}">
                <div class="flex justify-between items-start">
                    <div class="flex items-start space-x-3 flex-1">
                        <div class="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            ${index + 1}
                        </div>
                        <div class="flex-1">
                            <p class="text-gray-800 font-medium leading-relaxed">${this.escapeHtml(q.question)}</p>
                            <div class="flex items-center space-x-4 mt-2 text-xs">
                                ${q.is_answered ? 
                                    `<span class="bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                        <i class="fas fa-check mr-1"></i>Beantwortet
                                    </span>` : 
                                    `<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                        <i class="fas fa-clock mr-1"></i>Offen
                                    </span>`
                                }
                                ${q.answered_count > 0 ? `<span class="text-green-600">${q.answered_count}× beantwortet</span>` : ''}
                                ${q.unanswered_count > 0 ? `<span class="text-orange-600">${q.unanswered_count}× offen</span>` : ''}
                            </div>
                            ${q.similar_questions && q.similar_questions.length > 1 ? 
                                `<div class="mt-2">
                                    <p class="text-xs text-gray-400 mb-1">Varianten (${q.similar_questions.length}):</p>
                                    <div class="text-xs text-gray-600">
                                        ${q.similar_questions.slice(0, 2).map(sq => 
                                            `<span class="inline-block bg-gray-100 px-2 py-1 rounded mr-1 mb-1">${this.escapeHtml(sq)}</span>`
                                        ).join('')}
                                        ${q.similar_questions.length > 2 ? 
                                            `<span class="text-xs text-gray-400">+${q.similar_questions.length - 2} weitere</span>` : ''
                                        }
                                    </div>
                                </div>` : ''
                            }
                        </div>
                    </div>
                    <div class="flex flex-col items-center ml-3">
                        <span class="question-badge">${q.count}×</span>
                        <span class="text-xs text-gray-400 mt-1">gesamt</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Utility Methods
    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
    }

    showError(message) {
        // Create error banner if doesn't exist
        let errorBanner = document.getElementById('error-banner');
        if (!errorBanner) {
            errorBanner = document.createElement('div');
            errorBanner.id = 'error-banner';
            errorBanner.className = 'alert alert-error';
            document.querySelector('main').prepend(errorBanner);
        }
        
        errorBanner.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-auto text-lg">&times;</button>
            </div>
        `;
    }

    updateLastRefresh() {
        document.getElementById('last-update').textContent = new Date().toLocaleString('de-DE');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDateShort(dateString) {
        return new Date(dateString).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit'
        });
    }
}

// Initialize Dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.dashboard && window.dashboard.refreshInterval) {
        clearInterval(window.dashboard.refreshInterval);
    }
});