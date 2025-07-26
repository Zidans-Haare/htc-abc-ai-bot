document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('articles-container');

    try {
        const response = await fetch('/api/view/articles');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const articles = await response.json();

        if (articles.length === 0) {
            container.innerHTML += '<p>Keine Artikel gefunden.</p>';
            return;
        }

        articles.forEach(article => {
            const articleDiv = document.createElement('div');

            const headline = document.createElement('h1');
            headline.textContent = article.headline;

            const content = document.createElement('p');
            content.textContent = article.content;

            const separator = document.createElement('hr');

            articleDiv.appendChild(headline);
            articleDiv.appendChild(content);
            container.appendChild(articleDiv);
            container.appendChild(separator);
        });

    } catch (error) {
        console.error('Fehler beim Laden der Artikel:', error);
        container.innerHTML += '<p class="error">Artikel konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>';
    }
});
