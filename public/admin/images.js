import { createApi } from './api.js';

export function initImages() {
    const api = createApi();
    const imagesList = document.getElementById('images-list');

    async function loadImages() {
        try {
            const images = await api.get('/api/admin/images');
            renderImages(images);
        } catch (error) {
            console.error('Fehler beim Laden der Bilder:', error);
            imagesList.innerHTML = '<p class="text-red-500">Fehler beim Laden der Bilder.</p>';
        }
    }

    function renderImages(images) {
        if (images.lengt === 0) {
            imagesList.innerHTML = '<p>Keine Bilder gefunden.</p>';
            return;
        }

        imagesList.innerHTML = images.map(bild => `
            <div class="p-4 border rounded-lg">
                <p class="font-semibold">${bild.filename}</p>
                <p>${bild.description || 'Keine Beschreibung'}</p>
            </div>
        `).join('');
    }

    loadImages();
}
