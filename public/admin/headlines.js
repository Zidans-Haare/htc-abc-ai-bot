import { fetchAndParse } from './utils.js';

let currentId = null;
let allHeadlines = [];
let selectedHeadlineEl = null;
let originalHeadline = '';
let originalText = '';

const listEl = document.getElementById('headline-list');
const searchEl = document.getElementById('search');
const headlineInput = document.getElementById('headline-input');
const activeCheckbox = document.getElementById('active-toggle');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const addBtn = document.getElementById('add-heading');
const editor = new toastui.Editor({
  el: document.getElementById('editor'),
  height: '100%',
  initialEditType: 'wysiwyg',
  previewStyle: 'vertical',
  toolbarItems: [
    ['heading', 'bold', 'italic', 'link', 'image']
  ]
});

function setSaveButtonState(enabled) {
  if (enabled) {
    saveBtn.disabled = false;
    saveBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
    saveBtn.classList.add('bg-blue-500');
  } else {
    saveBtn.disabled = true;
    saveBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
    saveBtn.classList.remove('bg-blue-500');
  }
}

function checkForChanges() {
  const currentHeadline = headlineInput.value;
  const currentText = editor.getMarkdown();
  if (currentHeadline !== originalHeadline || currentText !== originalText) {
    setSaveButtonState(true);
  } else {
    setSaveButtonState(false);
  }
}

async function loadHeadlines() {
  console.log('Fetching headlines...');
  try {
    const q = encodeURIComponent(searchEl.value.trim());
    allHeadlines = await fetchAndParse(`/api/admin/headlines?q=${q}`);
    console.log('Headlines received:', allHeadlines);
    selectedHeadlineEl = null;
    renderHeadlines(allHeadlines);
  } catch (err) {
    console.error('Failed to load headlines:', err);
    listEl.innerHTML = '<div>Fehler beim Laden der Überschriften</div>';
  }
}

function renderHeadlines(items) {
  console.log('Rendering headlines:', items);
  listEl.innerHTML = '';
  if (items.length === 0) {
    listEl.innerHTML = '<div>Keine Überschriften verfügbar</div>';
    return;
  }
  items.forEach(h => {
    const li = document.createElement('li');
    li.textContent = h.headline;
    li.className = 'p-2 hover:bg-gray-100 cursor-pointer rounded';
    li.dataset.id = h.id;
    li.addEventListener('click', () => {
      if (selectedHeadlineEl) {
        selectedHeadlineEl.classList.remove('bg-blue-600', 'text-white', 'font-bold');
      }
      li.classList.add('bg-blue-600', 'text-white', 'font-bold');
      selectedHeadlineEl = li;
      loadEntry(h.id);
    });
    listEl.appendChild(li);
    if (currentId && String(currentId) === String(h.id)) {
      li.classList.add('bg-blue-600', 'text-white', 'font-bold');
      selectedHeadlineEl = li;
    }
  });
}

async function loadEntry(id) {
  try {
    console.log('Fetching entry:', id);
    const entry = await fetchAndParse(`/api/admin/entries/${id}`);
    console.log('Entry received:', entry);
    currentId = entry.id;
    headlineInput.value = entry.headline;
    editor.setMarkdown(entry.text);
    originalHeadline = entry.headline;
    originalText = entry.text;
    activeCheckbox.checked = !!entry.active;
    const timestamp = entry.lastUpdated ? new Date(entry.lastUpdated) : null;
    const formattedDate = timestamp
      ? `${timestamp.getDate()}.${timestamp.getMonth() + 1}.'${String(timestamp.getFullYear()).slice(-2)} ${timestamp.getHours()}:${String(timestamp.getMinutes()).padStart(2, '0')}`
      : '';
    document.getElementById('current-user').innerHTML = `last edit by:<br>${entry.editor || ''}<br>${formattedDate}`;
    setSaveButtonState(false);
  } catch (err) {
    console.error('Failed to load entry:', err);
  }
}

async function saveEntry() {
  const payload = {
    headline: headlineInput.value.trim(),
    text: editor.getMarkdown().trim(),
    active: activeCheckbox.checked
  };
  if (!payload.headline || !payload.text) return;
  try {
    console.log('Saving entry:', payload);
    let res;
    if (currentId) {
      res = await fetch(`/api/admin/entries/${currentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/admin/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    if (!res.ok) {
      const error = await res.json();
      throw new Error(`HTTP error ${res.status}: ${error.error || 'Unknown error'}`);
    }
    const data = await res.json();
    console.log('Entry saved:', data);
    currentId = data.id;
    await loadHeadlines();
    await loadEntry(currentId);
  } catch (err) {
    console.error('Failed to save entry:', err);
    alert('Failed to save entry: ' + err.message);
  }
}

async function deleteEntry() {
  if (!currentId) return;
  try {
    console.log('Deleting entry:', currentId);
    await fetchAndParse(`/api/admin/entries/${currentId}`, { method: 'DELETE' });
    console.log('Entry deleted');
    currentId = null;
    headlineInput.value = '';
    editor.setMarkdown('');
    activeCheckbox.checked = false;
    document.getElementById('current-user').innerHTML = `last edit by:<br>`;
    await loadHeadlines();
    alert('Gelöscht');
  } catch (err) {
    console.error('Failed to delete entry:', err);
    alert('Failed to delete entry: ' + err.message);
  }
}

export function initHeadlines() {
  saveBtn.addEventListener('click', saveEntry);
  deleteBtn.addEventListener('click', deleteEntry);
  addBtn.addEventListener('click', () => {
    console.log('Adding new heading...');
    currentId = null;
    headlineInput.value = '';
    editor.setMarkdown('');
    originalHeadline = '';
    originalText = '';
    activeCheckbox.checked = true;
    document.getElementById('current-user').innerHTML = `last edit by:<br>`;
    checkForChanges();
  });
  searchEl.addEventListener('input', () => {
    console.log('Search input changed, loading headlines...');
    loadHeadlines();
  });

  headlineInput.addEventListener('input', checkForChanges);
  editor.addHook('change', checkForChanges);

  loadHeadlines();
}

export { allHeadlines, loadHeadlines };