import { fetchAndParse } from './utils.js';

let imagesView;
let imagesList;

export function initImages() {
    imagesView = document.getElementById('images-view');
    if (!imagesView) {
        console.error('Images view not found');
        return;
    }

    // Create the UI structure
    imagesView.innerHTML = `
        <div class="p-4 bg-white shadow-md rounded-lg">
            <h2 class="text-xl font-semibold mb-4">Bilder hochladen</h2>
            <div class="flex items-end space-x-4">
                <div>
                    <input type="file" id="image-upload-input" accept="image/*" class="hidden"/>
                    <label for="image-upload-input" class="cursor-pointer btn-primary px-6 py-2 rounded-full">Bild wählen</label>
                    <p id="image-file-name" class="text-sm text-gray-500 mt-2">Kein Bild ausgewählt</p>
                </div>
                <textarea id="image-description-input" class="flex-grow p-2 border border-[var(--input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-color)]" placeholder="Bildbeschreibung..."></textarea>
                <button id="image-upload-button" class="btn-primary px-6 py-2 rounded-full">Hochladen</button>
            </div>
        </div>
        <div class="mt-6 p-4 bg-white shadow-md rounded-lg">
            <h2 class="text-xl font-semibold mb-4">Galerie</h2>
            <div id="images-list" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <!-- Images will be loaded here -->
            </div>
        </div>
    `;

    imagesList = document.getElementById('images-list');
    const uploadInput = document.getElementById('image-upload-input');
    const descriptionInput = document.getElementById('image-description-input');
    const uploadButton = document.getElementById('image-upload-button');
    const fileNameDisplay = document.getElementById('image-file-name');

    uploadInput.addEventListener('change', () => {
        if (uploadInput.files.length > 0) {
            fileNameDisplay.textContent = uploadInput.files[0].name;
        } else {
            fileNameDisplay.textContent = 'Kein Bild ausgewählt';
        }
    });

    uploadButton.addEventListener('click', () => handleImageUpload(uploadInput, descriptionInput));

    // Load images when the view is shown
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (!imagesView.classList.contains('hidden')) {
                    loadImages();
                }
            }
        }
    });

    observer.observe(imagesView, { attributes: true });

    // Initial load if view is already visible
    if (!imagesView.classList.contains('hidden')) {
        loadImages();
    }
}

async function loadImages() {
    try {
        const images = await fetchAndParse('/api/admin/images');
        renderImages(images);
    } catch (error) {
        console.error('Error loading images:', error);
        imagesList.innerHTML = '<p class="text-red-500">Fehler beim Laden der Bilder.</p>';
    }
}

function renderImages(images) {
    if (!images || images.length === 0) {
        imagesList.innerHTML = '<p class="text-gray-500">Keine Bilder gefunden.</p>';
        return;
    }

    imagesList.innerHTML = images.map(image => `
        <div class="relative group border rounded-lg overflow-hidden shadow-sm">
            <img src="/uploads/${image.filename}" alt="${image.description || image.filename}" class="w-full h-48 object-cover">
            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 p-2 text-white text-sm truncate" title="${image.description || image.filename}">
                ${image.filename}
            </div>
            <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="copy-url-btn text-white hover:text-[var(--accent-color)] transition-colors" data-url="/uploads/${image.filename}" title="URL kopieren">
                    <i class="fas fa-copy fa-lg"></i>
                </button>
                <button class="delete-image-btn text-white hover:text-red-500 transition-colors ml-4" data-filename="${image.filename}" title="Löschen">
                    <i class="fas fa-trash-alt fa-lg"></i>
                </button>
            </div>
        </div>
    `).join('');

    // Add event listeners for the new buttons
    imagesList.querySelectorAll('.copy-url-btn').forEach(button => {
        button.addEventListener('click', handleCopyUrl);
    });
    imagesList.querySelectorAll('.delete-image-btn').forEach(button => {
        button.addEventListener('click', handleDeleteImage);
    });
}

async function handleImageUpload(inputElement, descriptionElement) {
    const file = inputElement.files[0];
    const description = descriptionElement.value.trim();

    if (!file) {
        alert('Noch kein Bild gewählt.');
        return;
    }
    if (!description) {
        alert('Bitte eine Beschreibung eingeben.');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('description', description);

    try {
        const response = await fetch('/api/admin/images/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Upload fehlgeschlagen');
        }

        await response.json();
        inputElement.value = ''; // Clear the input
        descriptionElement.value = ''; // Clear the textarea
        document.getElementById('image-file-name').textContent = 'Kein Bild ausgewählt';
        await loadImages(); // Refresh the gallery
    } catch (error) {
        console.error('Error uploading image:', error);
        alert(`Fehler beim Hochladen des Bildes: ${error.message}`);
    }
}

function handleCopyUrl(event) {
    const url = event.currentTarget.dataset.url;
    const fullUrl = window.location.origin + url;
    navigator.clipboard.writeText(fullUrl).then(() => {
        alert('URL in die Zwischenablage kopiert!');
    }).catch(err => {
        console.error('Could not copy text: ', err);
        alert('Fehler beim Kopieren der URL.');
    });
}

async function handleDeleteImage(event) {
    const filename = event.currentTarget.dataset.filename;
    if (!confirm(`Sind Sie sicher, dass Sie das Bild "${filename}" löschen möchten?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/images/${filename}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Löschen fehlgeschlagen');
        }

        await loadImages(); // Refresh the gallery
    } catch (error) {
        console.error('Error deleting image:', error);
        alert(`Fehler beim Löschen des Bildes: ${error.message}`);
    }
}