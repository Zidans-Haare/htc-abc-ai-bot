import { fetchAndParse } from './utils.js';

let pdfView;
let pdfList;

export function initPDFs() {
    pdfView = document.getElementById('pdf-view');
    if (!pdfView) {
        console.error('PDF view not found');
        return;
    }

    // Create the UI structure
    pdfView.innerHTML = `
        <div class="p-4 bg-white shadow-md rounded-lg">
            <h2 class="text-xl font-semibold mb-4">PDFs hochladen</h2>
            <div class="flex items-end space-x-4">
                <div>
                    <input type="file" id="pdf-upload-input" accept="application/pdf" class="hidden"/>
                    <label for="pdf-upload-input" class="cursor-pointer btn-primary px-6 py-2 rounded-full">PDF wählen</label>
                    <p id="pdf-file-name" class="text-sm text-gray-500 mt-2">Kein PDF ausgewählt</p>
                </div>
                <textarea id="pdf-description-input" class="flex-grow p-2 border border-[var(--input-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-color)]" placeholder="PDF-Beschreibung..."></textarea>
                <button id="pdf-upload-button" class="btn-primary px-6 py-2 rounded-full">Hochladen</button>
            </div>
        </div>
        <div class="mt-6 p-4 bg-white shadow-md rounded-lg">
            <h2 class="text-xl font-semibold mb-4">PDF-Galerie</h2>
            <div id="pdf-list" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <!-- PDFs will be loaded here -->
            </div>
        </div>
    `;

    pdfList = document.getElementById('pdf-list');
    const uploadInput = document.getElementById('pdf-upload-input');
    const descriptionInput = document.getElementById('pdf-description-input');
    const uploadButton = document.getElementById('pdf-upload-button');
    const fileNameDisplay = document.getElementById('pdf-file-name');

    uploadInput.addEventListener('change', () => {
        if (uploadInput.files.length > 0) {
            fileNameDisplay.textContent = uploadInput.files[0].name;
        } else {
            fileNameDisplay.textContent = 'Kein PDF ausgewählt';
        }
    });

    uploadButton.addEventListener('click', () => handlePDFUpload(uploadInput, descriptionInput));

    // Load PDFs when the view is shown
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (!pdfView.classList.contains('hidden')) {
                    loadPDFs();
                }
            }
        }
    });

    observer.observe(pdfView, { attributes: true });

    // Initial load if view is already visible
    if (!pdfView.classList.contains('hidden')) {
        loadPDFs();
    }
}

async function loadPDFs() {
    try {
        const pdfs = await fetchAndParse('/api/admin/pdfs');
        renderPDFs(pdfs);
    } catch (error) {
        console.error('Error loading PDFs:', error);
        pdfList.innerHTML = '<p class="text-red-500">Fehler beim Laden der PDFs.</p>';
    }
}

function renderPDFs(pdfs) {
    if (!pdfs || pdfs.length === 0) {
        pdfList.innerHTML = '<p class="text-gray-500">Keine PDFs gefunden.</p>';
        return;
    }

    pdfList.innerHTML = pdfs.map(pdf => `
        <div class="group border rounded-lg overflow-hidden shadow-sm flex flex-col">
            <div class="relative">
                <div class="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <i class="fas fa-file-pdf fa-3x text-red-500"></i>
                </div>
                <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="copy-url-btn text-white hover:text-[var(--accent-color)] transition-colors" data-url="/uploads/${pdf.filename}" title="URL kopieren">
                        <i class="fas fa-copy fa-lg"></i>
                    </button>
                    <button class="edit-pdf-btn text-white hover:text-yellow-400 transition-colors ml-4" data-filename="${pdf.filename}" data-description="${pdf.description || ''}" title="Beschreibung bearbeiten">
                        <i class="fas fa-pencil-alt fa-lg"></i>
                    </button>
                    <button class="delete-pdf-btn text-white hover:text-red-500 transition-colors ml-4" data-filename="${pdf.filename}" title="Löschen">
                        <i class="fas fa-trash-alt fa-lg"></i>
                    </button>
                </div>
            </div>
            <div class="p-2">
                <p class="text-sm text-gray-700 truncate" title="${pdf.description || ''}">${pdf.description || ''}</p>
                <p class="text-xs text-gray-500 truncate" title="${pdf.filename}">${pdf.filename}</p>
            </div>
        </div>
    `).join('');

    // Add event listeners for the new buttons
    pdfList.querySelectorAll('.copy-url-btn').forEach(button => {
        button.addEventListener('click', handleCopyUrl);
    });
    pdfList.querySelectorAll('.edit-pdf-btn').forEach(button => {
        button.addEventListener('click', handleEditPDF);
    });
    pdfList.querySelectorAll('.delete-pdf-btn').forEach(button => {
        button.addEventListener('click', handleDeletePDF);
    });
}

async function handlePDFUpload(inputElement, descriptionElement) {
    const file = inputElement.files[0];
    const description = descriptionElement.value.trim();

    if (!file) {
        alert('Noch kein PDF gewählt.');
        return;
    }
    if (!description) {
        alert('Bitte eine Beschreibung eingeben.');
        return;
    }

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('description', description);

    try {
        const response = await fetch('/api/admin/pdfs/upload', {
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
        document.getElementById('pdf-file-name').textContent = 'Kein PDF ausgewählt';
        await loadPDFs(); // Refresh the gallery
    } catch (error) {
        console.error('Error uploading PDF:', error);
        alert(`Fehler beim Hochladen des PDFs: ${error.message}`);
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

function handleEditPDF(event) {
    const button = event.currentTarget;
    const filename = button.dataset.filename;
    const currentDescription = button.dataset.description;

    const modal = document.getElementById('edit-pdf-modal');
    const descriptionInput = document.getElementById('edit-pdf-description-input');
    const cancelButton = document.getElementById('edit-pdf-cancel');
    const saveButton = document.getElementById('edit-pdf-save');

    descriptionInput.value = currentDescription;

    modal.classList.remove('hidden');

    const closeAndCleanup = () => {
        modal.classList.add('hidden');
        saveButton.onclick = null; // Remove the specific listener
    };

    cancelButton.onclick = closeAndCleanup;

    saveButton.onclick = async () => {
        const newDescription = descriptionInput.value.trim();
        if (newDescription === currentDescription) {
            closeAndCleanup();
            return;
        }

        try {
            const response = await fetch(`/api/admin/pdfs/${filename}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ description: newDescription })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Update fehlgeschlagen');
            }

            await loadPDFs(); // Refresh the gallery
        } catch (error) {
            console.error('Error updating PDF description:', error);
            alert(`Fehler beim Aktualisieren der Beschreibung: ${error.message}`);
        } finally {
            closeAndCleanup();
        }
    };
}

async function handleDeletePDF(event) {
    const filename = event.currentTarget.dataset.filename;
    if (!confirm(`Sind Sie sicher, dass Sie das PDF "${filename}" löschen möchten?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/pdfs/${filename}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Löschen fehlgeschlagen');
        }

        await loadPDFs(); // Refresh the gallery
    } catch (error) {
        console.error('Error deleting PDF:', error);
        alert(`Fehler beim Löschen des PDFs: ${error.message}`);
    }
}