import { renderMarkup } from '../js/markup.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('articles-container');
    const sortToggle = document.getElementById('sort-toggle');
    let currentSort = 'alpha'; // Initial sort is alphabetical

    async function loadArticles(sort) {
        // Clear existing articles
        const existingArticles = container.querySelectorAll('.article-entry, .separator');
        existingArticles.forEach(el => el.remove());

        try {
            const response = await fetch(`/api/view/articles?sort=${sort}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const articles = await response.json();

            if (articles.length === 0) {
                const noArticles = document.createElement('p');
                noArticles.textContent = 'Keine Artikel gefunden.';
                noArticles.className = 'article-entry';
                container.appendChild(noArticles);
                return;
            }

            articles.forEach(article => {
                const articleDiv = document.createElement('div');
                articleDiv.className = 'article-entry';

                const headline = document.createElement('h1');
                headline.textContent = article.headline;

                const content = document.createElement('p');
                content.innerHTML = renderMarkup(article.content);

                const separator = document.createElement('hr');
                separator.className = 'separator';

                articleDiv.appendChild(headline);
                articleDiv.appendChild(content);
                container.appendChild(articleDiv);
                container.appendChild(separator);
            });

        } catch (error) {
            console.error('Fehler beim Laden der Artikel:', error);
            const errorMsg = document.createElement('p');
            errorMsg.className = 'error article-entry';
            errorMsg.textContent = 'Artikel konnten nicht geladen werden. Bitte versuchen Sie es später erneut.';
            container.appendChild(errorMsg);
        }
    }

    function updateSortToggleText() {
        if (currentSort === 'alpha') {
            sortToggle.textContent = 'neueste zuerst';
        } else {
            sortToggle.textContent = 'alphabetisch';
        }
    }

    sortToggle.addEventListener('click', () => {
        currentSort = currentSort === 'alpha' ? 'recent' : 'alpha';
        updateSortToggleText();
        loadArticles(currentSort);
    });

    // Initial load
    updateSortToggleText(); // Set initial text correctly
    loadArticles(currentSort);
});
