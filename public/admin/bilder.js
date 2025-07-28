import { createApi } from './api.js';

export function initBilder() {
    const api = createApi();
    const bilderList = document.getElementById('bilder-list');

    async function loadBilder() {
        try {
            const bilder = await api.get('/api/admin/images');
            renderBilder(bilder);
        } catch (error) {
            console.error('Fehler beim Laden der Bilder:', error);
            bilderList.innerHTML = '<p class="text-red-500">Fehler beim Laden der Bilder.</p>';
        }
    }

    function renderBilder(bilder) {
        if (bilder.length === 0) {
            bilderList.innerHTML = '<p>Keine Bilder gefunden.</p>';
            return;
        }

        bilderList.innerHTML = bilder.map(bild => `
            <div class="p-4 border rounded-lg">
                <p class="font-semibold">${bild.filename}</p>
                <p>${bild.description || 'Keine Beschreibung'}</p>
            </div>
        `).join('');
    }

    loadBilder();
}
