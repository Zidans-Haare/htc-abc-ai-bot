import { fetchAndParse } from './utils.js';
import { createMilkdownEditor, setMarkdown, onChange } from './milk.js';

let currentId = null;
let allHeadlines = [];
let selectedHeadlineEl = null;
let originalHeadline = '';
let originalText = '';
let textBeforeAiCheck = '';

const listEl = document.getElementById('headline-list');
const searchEl = document.getElementById('search');
const headlineInput = document.getElementById('headline-input');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const addBtn = document.getElementById('add-heading');
const aiCheckModal = document.getElementById('ai-check-modal');
const aiCheckCloseBtn = document.getElementById('ai-check-close');
const aiCheckResponseEl = document.getElementById('ai-check-response');

const loadedScripts = {};

function loadScript(src) {
  if (loadedScripts[src]) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      loadedScripts[src] = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Script load error for ${src}`));
    };
    document.head.appendChild(script);
  });
}

async function markDiffInMarkdown(originalText, improvedText) {
  try {
    await loadScript('/js/diff_match_patch.js');
    const dmp = new diff_match_patch();
    const diff = dmp.diff_main(originalText, improvedText);
    dmp.diff_cleanupSemantic(diff);
    
    let markdown = '';
    diff.forEach(part => {
      const type = part[0];
      const data = part[1];
      switch (type) {
        case 0: markdown += data; break;
        case 1: markdown += `**${data}**`; break; // Using bold for insertions
        case -1: markdown += `~~${data}~~`; break; // Using strikethrough for deletions
      }
    });
    return markdown;
  } catch (error) {
    console.error('Diff patch error:', error);
    aiCheckResponseEl.innerText = `Fehler beim Diff: ${error.message}`;
    return improvedText; // Fallback to the improved text without marking
  }
}

async function handleImproveClick(suggestionText) {
  const improveBtn = document.querySelector(`button[data-suggestion="${suggestionText}"]`);
  if(improveBtn) {
    improveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    improveBtn.disabled = true;
  }

  try {
    const response = await fetch('/api/admin/improve-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textBeforeAiCheck, suggestion: suggestionText })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Fehler bei der Verbesserung');
    }

    const result = await response.json();
    let markdown = await markDiffInMarkdown(textBeforeAiCheck, result.improvedText);
    setMarkdown(markdown);
    aiCheckModal.classList.add('hidden');

  } catch (error) {
    console.error('Improve Text Error:', error);
    alert(`Fehler bei der Verbesserung: ${error.message}`);
  } finally {
    if(improveBtn) {
      improveBtn.innerHTML = 'Verbessern';
      improveBtn.disabled = false;
    }
  }
}

async function handleAiCheck() {
  let text = getMilkdownMarkdown();
  text = text.replace(/~~/g, '').replace(/\*\*/g, ''); // Clean up previous markings
  textBeforeAiCheck = text;

  if (!text.trim()) {
    alert('Der Editor ist leer.');
    return;
  }

  aiCheckModal.classList.remove('hidden');
  aiCheckResponseEl.innerHTML = 'Analysiere...';

  try {
    const response = await fetch('/api/admin/analyze-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Fehler bei der Analyse');
    }

    const result = await response.json();
    if (typeof result.correctedText !== 'string') {
      throw new Error('AI response did not include the required "correctedText" field.');
    }

    let markdown = await markDiffInMarkdown(text, result.correctedText);
    setMarkdown(markdown);
    
    // Populate the modal with suggestions and contradictions
    aiCheckResponseEl.innerHTML = '';
    // ... (rest of the logic for displaying suggestions)

  } catch (error) {
    console.error('AI Check Error:', error);
    aiCheckResponseEl.innerText = `Fehler bei der Analyse: ${error.message}`;
  }
}

function setSaveButtonState(enabled) {
  if (enabled) {
    saveBtn.disabled = false;
    saveBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
    saveBtn.classList.add('btn-primary');
  } else {
    saveBtn.disabled = true;
    saveBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
    saveBtn.classList.remove('btn-primary');
  }
}

function checkForChanges() {
  const currentHeadline = headlineInput.value;
  const currentText = getMilkdownMarkdown();
  const hasChanged = currentHeadline !== originalHeadline || currentText !== originalText;
  setSaveButtonState(hasChanged);
}

async function loadHeadlines() {
  try {
    const q = encodeURIComponent(searchEl.value.trim());
    allHeadlines = await fetchAndParse(`/api/admin/headlines?q=${q}`);
    renderHeadlines(allHeadlines);
  } catch (err) {
    console.error('Failed to load headlines:', err);
    listEl.innerHTML = '<div>Fehler beim Laden der Überschriften</div>';
  }
}

function renderHeadlines(items) {
  listEl.innerHTML = '';
  if (items.length === 0) {
    listEl.innerHTML = '<div class="p-2 text-[var(--secondary-text)]">Keine Überschriften gefunden.</div>';
    return;
  }
  items.forEach(h => {
    const li = document.createElement('li');
    li.textContent = h.headline;
    li.className = 'headline-item p-2 cursor-pointer rounded transition-colors';
    li.dataset.id = h.id;
    li.addEventListener('click', () => {
      if (selectedHeadlineEl) {
        selectedHeadlineEl.classList.remove('active-headline');
      }
      li.classList.add('active-headline');
      selectedHeadlineEl = li;
      loadEntry(h.id);
    });
    listEl.appendChild(li);
    if (currentId && String(currentId) === String(h.id)) {
      li.classList.add('active-headline');
      selectedHeadlineEl = li;
    }
  });
}

export async function loadEntry(id) {
  try {
    const entry = await fetchAndParse(`/api/admin/entries/${id}`);
    currentId = entry.id;
    headlineInput.value = entry.headline;
    setMarkdown(entry.text);
    originalHeadline = entry.headline;
    originalText = entry.text;
    const timestamp = entry.lastUpdated ? new Date(entry.lastUpdated) : null;
    const formattedDate = timestamp
      ? `${timestamp.getDate()}.${timestamp.getMonth() + 1}.'${String(timestamp.getFullYear()).slice(-2)} ${timestamp.getHours()}:${String(timestamp.getMinutes()).padStart(2, '0')}`
      : '';
    document.getElementById('last-edited-by').innerHTML = `last edit by:<br>${entry.editor || ''}<br>${formattedDate}`;
    setSaveButtonState(false);
  } catch (err) {
    console.error('Failed to load entry:', err);
  }
}

export async function saveEntry() {
  const cleanedText = getMilkdownMarkdown().replace(/~~/g, '').replace(/\*\*/g, '');
  const payload = {
    headline: headlineInput.value.trim(),
    text: cleanedText.trim(),
    active: true
  };
  if (!payload.headline || !payload.text) return;
  try {
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
    await fetchAndParse(`/api/admin/entries/${currentId}`, { method: 'DELETE' });
    currentId = null;
    headlineInput.value = '';
    setMarkdown('');
    document.getElementById('last-edited-by').innerHTML = `last edit by:<br>`;
    await loadHeadlines();
    alert('Gelöscht');
  } catch (err) {
    console.error('Failed to delete entry:', err);
    alert('Failed to delete entry: ' + err.message);
  }
}

export function selectHeadline(id) {
  const headlineElement = listEl.querySelector(`li[data-id='${id}']`);
  if (headlineElement) {
    headlineElement.click();
  }
}

export function getCurrentId() {
  return currentId;
}

export function initHeadlines() {
  createMilkdownEditor(handleAiCheck);

  saveBtn.addEventListener('click', saveEntry);
  deleteBtn.addEventListener('click', deleteEntry);
  addBtn.addEventListener('click', () => {
    currentId = null;
    headlineInput.value = '';
    setMarkdown('');
    originalHeadline = '';
    originalText = '';
    document.getElementById('last-edited-by').innerHTML = `last edit by:<br>`;
    checkForChanges();
  });
  searchEl.addEventListener('input', () => {
    loadHeadlines();
  });

  headlineInput.addEventListener('input', checkForChanges);
  onChange(checkForChanges);

  aiCheckCloseBtn.addEventListener('click', () => {
    aiCheckModal.classList.add('hidden');
  });

  loadHeadlines();
}

export { allHeadlines, loadHeadlines };