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

async function handleImproveClick(suggestionText) {
  const originalText = editor.getMarkdown();
  
  // Show loading state
  const improveBtn = document.querySelector(`button[data-suggestion="${suggestionText}"]`);
  if(improveBtn) {
    improveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    improveBtn.disabled = true;
  }

  try {
    const response = await fetch('/api/admin/improve-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: originalText, suggestion: suggestionText })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Fehler bei der Verbesserung');
    }

    const result = await response.json();

    // Highlight changes in the editor
    const dmp = new diff_match_patch();
    const diff = dmp.diff_main(originalText, result.improvedText);
    dmp.diff_cleanupSemantic(diff);
    
    let html = '';
    diff.forEach(part => {
      const type = part[0];
      const data = part[1];
      const sanitizedData = data.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      switch (type) {
        case 0: html += sanitizedData; break;
        case 1: html += `<mark class="ai-insert">${sanitizedData}</mark>`; break;
        case -1: html += `<mark class="ai-delete">${sanitizedData}</mark>`; break;
      }
    });
    editor.setHTML(html);
    aiCheckModal.classList.add('hidden'); // Close modal on success

  } catch (error) {
    console.error('Improve Text Error:', error);
    alert(`Fehler bei der Verbesserung: ${error.message}`);
    if(improveBtn) {
      improveBtn.innerHTML = 'Verbessern';
      improveBtn.disabled = false;
    }
  }
}

async function handleAiCheck() {
  const text = editor.getMarkdown();
  if (!text.trim()) {
    alert('Der Editor ist leer.');
    return;
  }

  aiCheckModal.classList.remove('hidden');
  aiCheckResponseEl.innerHTML = 'Analysiere...';

  try {
    await loadScript('/js/diff_match_patch.js');
    
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
    
    // Update editor with highlighted changes
    const dmp = new diff_match_patch();
    const diff = dmp.diff_main(text, result.correctedText);
    dmp.diff_cleanupSemantic(diff);
    
    let html = '';
    diff.forEach(part => {
      const type = part[0];
      const data = part[1];
      const sanitizedData = data.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      switch (type) {
        case 0: // EQUAL
          html += sanitizedData;
          break;
        case 1: // INSERT
          html += `<mark class="ai-insert">${sanitizedData}</mark>`;
          break;
        case -1: // DELETE
          html += `<mark class="ai-delete">${sanitizedData}</mark>`;
          break;
      }
    });

    editor.setHTML(html);

    // Populate the modal with suggestions and contradictions
    aiCheckResponseEl.innerHTML = '';

    const actualCorrections = result.corrections.filter(item => item.original !== item.corrected);

    if (actualCorrections.length === 0 && result.contradictions.length === 0 && result.suggestions.length === 0) {
        aiCheckResponseEl.innerHTML = '<p>Keine weiteren Vorschläge oder Widersprüche gefunden. Die Rechtschreibkorrekturen wurden direkt im Text markiert.</p>';
    } else {
        if (actualCorrections.length > 0) {
            const correctionsList = document.createElement('div');
            correctionsList.innerHTML = '<h4 class="font-bold mb-2">Rechtschreib- & Grammatik-Hinweise</h4>';
            actualCorrections.forEach(item => {
                const div = document.createElement('div');
                div.className = 'ai-correction-item p-2 bg-gray-50 rounded mb-2';
                div.innerHTML = `Geändert von "<strong>${item.original}</strong>" zu "<strong>${item.corrected}</strong>" - <em>${item.reason}</em>`;
                correctionsList.appendChild(div);
            });
            aiCheckResponseEl.appendChild(correctionsList);
        }

        const createSuggestionItem = (item, type) => {
            const suggestionText = type === 'contradiction' ? item.contradiction : item.suggestion;
            const details = document.createElement('details');
            details.className = 'mb-2 cursor-pointer';
            const summary = document.createElement('summary');
            summary.className = `p-2 rounded flex justify-between items-center ${type === 'contradiction' ? 'bg-yellow-100' : 'bg-blue-100'}`;
            
            const suggestionContent = document.createElement('span');
            suggestionContent.textContent = suggestionText;
            
            const improveBtn = document.createElement('button');
            improveBtn.className = 'ml-4 px-3 py-1 text-sm rounded-md btn-secondary';
            improveBtn.textContent = 'Verbessern';
            improveBtn.dataset.suggestion = suggestionText;
            improveBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleImproveClick(suggestionText);
            };

            summary.appendChild(suggestionContent);
            summary.appendChild(improveBtn);
            details.appendChild(summary);

            const reason = document.createElement('p');
            reason.className = 'p-2 mt-1 bg-gray-50';
            reason.textContent = item.reason;
            details.appendChild(reason);

            return details;
        }

        if (result.contradictions.length > 0) {
            const contradictionsList = document.createElement('div');
            contradictionsList.innerHTML = '<h4 class="font-bold mt-4 mb-2">Widersprüche & Dopplungen</h4>';
            result.contradictions.forEach(item => {
                contradictionsList.appendChild(createSuggestionItem(item, 'contradiction'));
            });
            aiCheckResponseEl.appendChild(contradictionsList);
        }

        if (result.suggestions.length > 0) {
            const suggestionsList = document.createElement('div');
            suggestionsList.innerHTML = '<h4 class="font-bold mt-4 mb-2">Stil & Tonalität</h4>';
            result.suggestions.forEach(item => {
                suggestionsList.appendChild(createSuggestionItem(item, 'suggestion'));
            });
            aiCheckResponseEl.appendChild(suggestionsList);
        }
    }

  } catch (error) {
    console.error('AI Check Error:', error);
    aiCheckResponseEl.innerText = `Fehler bei der Analyse: ${error.message}`;
  }
}

function createMagicWandButton() {
    const button = document.createElement('button');
    button.className = 'toastui-editor-toolbar-icons ai-check-button';
    button.style.backgroundImage = 'none';
    button.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i>`;
    button.addEventListener('click', handleAiCheck);
    return button;
}

const editor = new toastui.Editor({
  el: document.getElementById('editor'),
  height: '100%',
  initialEditType: 'wysiwyg',
  previewStyle: 'vertical',
  toolbarItems: [
    ['heading', 'bold', 'italic', 'link'],
    [{
      name: 'ai-check',
      tooltip: 'AI Check',
      el: createMagicWandButton()
    }]
  ]
});

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
  const currentText = editor.getMarkdown();
  const hasChanged = currentHeadline !== originalHeadline || currentText !== originalText;
  setSaveButtonState(hasChanged);
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

    // If question banner is visible, link the article
    const questionBanner = document.getElementById('question-edit-banner');
    if (!questionBanner.classList.contains('hidden')) {
      const questionId = document.getElementById('question-edit-id').value;
      if (questionId && currentId) {
        await fetch('/api/admin/questions/link-article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: questionId, articleId: currentId }),
        });
        // Update banner text
        const answeredInDiv = document.getElementById('question-answered-in');
        if (answeredInDiv) {
            answeredInDiv.innerHTML = `<strong>Beantwortet in:</strong> ${payload.headline}`;
            answeredInDiv.style.display = 'block';
        }
      }
    }

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

  aiCheckCloseBtn.addEventListener('click', () => {
    aiCheckModal.classList.add('hidden');
  });

  loadHeadlines();
}

export { allHeadlines, loadHeadlines };