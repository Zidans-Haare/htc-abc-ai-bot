import { fetchAndParse } from './utils.js';

export function initCrawler() {
    const runCrawlerBtn = document.getElementById('run-crawler-btn');
    const crawlerStatus = document.getElementById('crawler-status');
    const crawledArticlesList = document.getElementById('crawled-articles-list');
    const modal = document.getElementById('crawled-article-modal');
    const modalHeadline = document.getElementById('crawled-article-headline');
    const modalContent = document.getElementById('crawled-article-content');
    const closeModalBtn = document.getElementById('crawled-article-close');

    runCrawlerBtn.addEventListener('click', async () => {
        const password = prompt('Bitte geben Sie das Passwort ein, um den Crawler zu starten:');
        if (password !== '-cliforthewin657-') {
            alert('Falsches Passwort.');
            return;
        }

        crawlerStatus.classList.remove('hidden');
        crawlerStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Crawling wird ausgeführt... Dieser Vorgang kann einige Minuten dauern.';
        runCrawlerBtn.disabled = true;
        runCrawlerBtn.classList.add('cursor-not-allowed');

        try {
            const result = await fetchAndParse('/api/admin/crawler/run', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: password })
            });
            crawlerStatus.innerHTML = `<strong>Erfolg!</strong><br><pre>${result.output}</pre>`;
            loadCrawledArticles();
        } catch (error) {
            console.error('Crawler error:', error);
            crawlerStatus.innerHTML = `<strong>Fehler:</strong><br><pre>${error.error || 'Unbekannter Fehler'}</pre>`;
        } finally {
            runCrawlerBtn.disabled = false;
            runCrawlerBtn.classList.remove('cursor-not-allowed');
        }
    });

    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    loadCrawledArticles();
}

async function loadCrawledArticles() {
    const crawledArticlesList = document.getElementById('crawled-articles-list');
    try {
        const articles = await fetchAndParse('/api/admin/articles/crawled');
        if (articles.length === 0) {
            crawledArticlesList.innerHTML = '<p>Noch keine Artikel vom Crawler importiert.</p>';
            return;
        }
        crawledArticlesList.innerHTML = ''; // Clear existing list
        articles.forEach(article => {
            const articleEl = document.createElement('div');
            articleEl.className = 'p-2 border-b border-[var(--border-color)] cursor-pointer hover:bg-gray-100 crawled-headline-item';
            articleEl.innerHTML = `
                <p class="font-medium">${article.headline}</p>
                <p class="text-sm text-[var(--secondary-text)]">Zuletzt aktualisiert: ${new Date(article.lastUpdated).toLocaleString()}</p>
            `;
            articleEl.addEventListener('click', () => showArticleInModal(article.id));
            crawledArticlesList.appendChild(articleEl);
        });
    } catch (error) {
        console.error('Error loading crawled articles:', error);
        crawledArticlesList.innerHTML = '<p class="text-red-500">Fehler beim Laden der gecrawlten Artikel.</p>';
    }
}

async function showArticleInModal(articleId) {
    try {
        const article = await fetchAndParse(`/api/admin/articles/${articleId}`);
        console.log('Fetched article:', article); // Debugging line
        const modal = document.getElementById('crawled-article-modal');
        const modalHeadline = document.getElementById('crawled-article-headline');
        const modalContent = document.getElementById('crawled-article-content');

        modalHeadline.textContent = article.headline;
        modalContent.innerHTML = marked.parse(DOMPurify.sanitize(article.text));
        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading article content:', error);
        alert('Fehler beim Laden des Artikelinhalts.');
    }
}
