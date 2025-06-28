document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('headline-list');
  const searchEl = document.getElementById('search');
  const editorEl = document.getElementById('editor');
  const addBtn = document.getElementById('add-heading');
  const pane = document.getElementById('editor-pane');

  // create headline input
  const headlineInput = document.createElement('input');
  headlineInput.id = 'headline-input';
  headlineInput.placeholder = 'Headline';
  headlineInput.className = 'p-2 border border-gray-300 rounded mb-2';
  pane.insertBefore(headlineInput, pane.firstChild);

  // footer controls
  const controls = document.createElement('div');
  controls.className = 'p-4 bg-white border-t border-gray-200 flex justify-end space-x-2';

  const activeLabel = document.createElement('label');
  activeLabel.className = 'flex items-center space-x-2 mr-auto';
  const activeCheckbox = document.createElement('input');
  activeCheckbox.type = 'checkbox';
  activeCheckbox.id = 'active-toggle';
  activeLabel.appendChild(activeCheckbox);
  const activeSpan = document.createElement('span');
  activeSpan.textContent = 'Active';
  activeLabel.appendChild(activeSpan);
  controls.appendChild(activeLabel);

  const deleteBtn = document.createElement('button');
  deleteBtn.id = 'delete-btn';
  deleteBtn.className = 'px-3 py-2 bg-red-500 text-white rounded';
  deleteBtn.textContent = 'Delete';
  controls.appendChild(deleteBtn);

  const saveBtn = document.createElement('button');
  saveBtn.id = 'save-btn';
  saveBtn.className = 'px-3 py-2 bg-blue-500 text-white rounded';
  saveBtn.textContent = 'Save';
  controls.appendChild(saveBtn);

  pane.appendChild(controls);

  let currentId = null;
  let allHeadlines = [];

  async function loadHeadlines() {
    try {
      const res = await fetch('/api/admin/headlines');
      allHeadlines = await res.json();
      renderHeadlines(allHeadlines);
    } catch (err) {
      console.error('Failed to load headlines', err);
    }
  }

  function renderHeadlines(items) {
    listEl.innerHTML = '';
    items.forEach(h => {
      const li = document.createElement('li');
      li.textContent = h.headline;
      li.className = 'p-2 hover:bg-gray-100 cursor-pointer rounded';
      li.dataset.id = h.id;
      li.addEventListener('click', () => loadEntry(h.id));
      listEl.appendChild(li);
    });
  }

  async function loadEntry(id) {
    try {
      const res = await fetch(`/api/admin/entries/${id}`);
      if (!res.ok) return;
      const entry = await res.json();
      currentId = entry.id;
      headlineInput.value = entry.headline;
      editorEl.innerHTML = entry.text;
      activeCheckbox.checked = !!entry.active;
    } catch (err) {
      console.error('Failed to load entry', err);
    }
  }

  async function saveEntry() {
    const payload = {
      headline: headlineInput.value.trim(),
      text: editorEl.innerHTML.trim(),
      active: activeCheckbox.checked
    };
    if (!payload.headline || !payload.text) return;
    try {
      let res;
      if (currentId) {
        res = await fetch(`/api/admin/entries/${currentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/admin/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      if (res.ok) {
        const data = await res.json();
        currentId = data.id;
        await loadHeadlines();
      }
    } catch (err) {
      console.error('Failed to save entry', err);
    }
  }

  async function deleteEntry() {
    if (!currentId) return;
    try {
      const res = await fetch(`/api/admin/entries/${currentId}`, { method: 'DELETE' });
      if (res.ok) {
        currentId = null;
        headlineInput.value = '';
        editorEl.innerHTML = '';
        activeCheckbox.checked = false;
        await loadHeadlines();
      }
    } catch (err) {
      console.error('Failed to delete entry', err);
    }
  }

  saveBtn.addEventListener('click', saveEntry);
  deleteBtn.addEventListener('click', deleteEntry);
  addBtn.addEventListener('click', () => {
    currentId = null;
    headlineInput.value = '';
    editorEl.innerHTML = '';
    activeCheckbox.checked = true;
  });

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.toLowerCase();
    const filtered = allHeadlines.filter(h => h.headline.toLowerCase().includes(q));
    renderHeadlines(filtered);
  });

  loadHeadlines();
});
