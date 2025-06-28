document.addEventListener('DOMContentLoaded', () => {
  // Tabs for switching between editor and question management
  const editorBtn = document.getElementById('btn-editor');
  const questionsBtn = document.getElementById('btn-questions');
  const editorView = document.getElementById('editor-view');
  const questionsView = document.getElementById('questions-view');

  function showEditor() {
    editorView.classList.remove('hidden');
    questionsView.classList.add('hidden');
    editorBtn.classList.add('bg-blue-600', 'text-white');
    editorBtn.classList.remove('bg-gray-200');
    questionsBtn.classList.remove('bg-blue-600', 'text-white');
    questionsBtn.classList.add('bg-gray-200');
  }

  function showQuestions() {
    questionsView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsBtn.classList.add('bg-blue-600', 'text-white');
    questionsBtn.classList.remove('bg-gray-200');
    editorBtn.classList.remove('bg-blue-600', 'text-white');
    editorBtn.classList.add('bg-gray-200');
    loadOpen();
    loadAnswered();
  }

  editorBtn.addEventListener('click', showEditor);
  questionsBtn.addEventListener('click', showQuestions);

  // Question management logic (copied from public/admin/index.html)
  const tabOpen = document.getElementById('tab-open');
  const tabAnswered = document.getElementById('tab-answered');
  const openList = document.getElementById('open-list');
  const answeredList = document.getElementById('answered-list');

  function showOpen() {
    openList.classList.remove('hidden');
    answeredList.classList.add('hidden');
    tabOpen.classList.add('bg-blue-600', 'text-white');
    tabAnswered.classList.remove('bg-blue-600', 'text-white');
    tabAnswered.classList.add('bg-gray-200');
    tabOpen.classList.remove('bg-gray-200');
  }

  function showAnswered() {
    answeredList.classList.remove('hidden');
    openList.classList.add('hidden');
    tabAnswered.classList.add('bg-blue-600', 'text-white');
    tabOpen.classList.remove('bg-blue-600', 'text-white');
    tabOpen.classList.add('bg-gray-200');
    tabAnswered.classList.remove('bg-gray-200');
  }

  tabOpen.addEventListener('click', showOpen);
  tabAnswered.addEventListener('click', showAnswered);

  async function loadOpen() {
    openList.innerHTML = '';
    try {
      const res = await fetch('/api/unanswered');
      const questions = await res.json();
      if (!Array.isArray(questions)) return;
      questions.forEach(q => {
        const div = document.createElement('div');
        div.className = 'border p-4 rounded';
        const form = document.createElement('form');
        form.innerHTML = `
          <p class="mb-2 font-medium">${q}</p>
          <input type="hidden" name="question" value="${q}">
          <input name="answer" class="border p-2 w-full mb-2" placeholder="Antwort" required>
          <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Senden</button>
        `;
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const data = { question: q, answer: form.answer.value };
          const resp = await fetch('/api/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (resp.ok) div.remove();
        });
        div.appendChild(form);
        openList.appendChild(div);
      });
    } catch (err) {
      openList.innerHTML = '<div>Fehler beim Laden</div>';
      console.error(err);
    }
  }

  async function loadAnswered() {
    answeredList.innerHTML = '';
    try {
      const res = await fetch('/api/answered');
      const pairs = await res.json();
      if (!Array.isArray(pairs)) return;
      pairs.forEach(p => {
        const div = document.createElement('div');
        div.className = 'border p-4 rounded';
        const form = document.createElement('form');
        form.innerHTML = `
          <p class="mb-2 font-medium">${p.question}</p>
          <input type="hidden" name="question" value="${p.question}">
          <input name="answer" class="border p-2 w-full mb-2" value="${p.answer}" required>
          <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Aktualisieren</button>
        `;
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const data = { question: p.question, answer: form.answer.value };
          await fetch('/api/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        });
        div.appendChild(form);
        answeredList.appendChild(div);
      });
    } catch (err) {
      answeredList.innerHTML = '<div>Fehler beim Laden</div>';
      console.error(err);
    }
  }

  // initially show editor
  showEditor();
  const listEl = document.getElementById('headline-list');
  const searchEl = document.getElementById('search');
  const editorEl = document.getElementById('editor');
  const addBtn = document.getElementById('add-heading');
  const pane = document.getElementById('editor-pane');

  const boldBtn = document.getElementById('btn-bold');
  const italicBtn = document.getElementById('btn-italic');
  const linkBtn = document.getElementById('btn-link');
  const headingBtn = document.getElementById('btn-heading');

  function exec(command, arg = null) {
    document.execCommand(command, false, arg);
    editorEl.focus();
  }

  boldBtn.addEventListener('click', () => exec('bold'));
  italicBtn.addEventListener('click', () => exec('italic'));
  linkBtn.addEventListener('click', () => {
    const url = prompt('Enter link URL');
    if (url) exec('createLink', url);
  });
  headingBtn.addEventListener('click', () => exec('formatBlock', 'h2'));

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
