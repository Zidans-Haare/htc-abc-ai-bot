document.addEventListener('DOMContentLoaded', async () => {
  console.log('Admin page loaded, initializing...');
  const token = sessionStorage.getItem('sessionToken');
  if (!token) {
    console.log('No session token, redirecting to login...');
    window.location.href = '/login/login.html';
    return;
  }

  // Validate session token
  try {
    const res = await fetch(`/api/validate?sessionToken=${encodeURIComponent(token)}`, {
      headers: { 'x-session-token': token }
    });
    if (!res.ok) {
      console.log('Session token invalid, redirecting to login...');
      sessionStorage.removeItem('sessionToken');
      sessionStorage.removeItem('userRole');
      window.location.href = '/login/login.html';
      return;
    }
  } catch (err) {
    console.error('Validation error:', err);
    sessionStorage.removeItem('sessionToken');
    sessionStorage.removeItem('userRole');
    window.location.href = '/login/login.html';
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    init.headers = init.headers || {};
    init.headers['x-session-token'] = token;
    console.log('Fetching:', input, 'with headers:', init.headers);
    const res = await originalFetch(input, init);
    if (res.status === 401) {
      console.error('Unauthorized request:', input);
      sessionStorage.removeItem('sessionToken');
      sessionStorage.removeItem('userRole');
      alert('Session abgelaufen, bitte erneut anmelden');
      window.location.href = '/login/login.html';
    }
    return res;
  };

  console.log('Setting up admin panel...');
  if (sessionStorage.getItem('userRole') === 'admin') {
    console.log('Admin role detected, showing user admin panel');
    document.getElementById('user-admin').classList.remove('hidden');
    document.getElementById('create-user').addEventListener('click', async () => {
      const u = document.getElementById('new-user').value.trim();
      const p = document.getElementById('new-pass').value.trim();
      const r = document.getElementById('new-role').value;
      if (!u || !p) return;
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-session-token': sessionStorage.getItem('sessionToken') },
          body: JSON.stringify({ username: u, password: p, role: r })
        });
        if (res.ok) {
          alert('User created');
        } else {
          const error = await res.json();
          console.error('User creation failed:', error);
          alert('User creation failed: ' + (error.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('User creation error:', err);
        alert('User creation error');
      }
    });
  }

  console.log('Adding event listeners for navigation...');
  const editorBtn = document.getElementById('btn-editor');
  const questionsBtn = document.getElementById('btn-questions');
  const archiveBtn = document.getElementById('btn-archive');
  const exportBtn = document.getElementById('btn-export');
  const logoutBtn = document.getElementById('btn-logout');
  const openCountSpan = document.getElementById('open-count');
  const editorView = document.getElementById('editor-view');
  const questionsView = document.getElementById('questions-view');
  const archiveView = document.getElementById('archive-view');

  function showEditor() {
    console.log('Showing editor view...');
    editorView.classList.remove('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    editorBtn.classList.add('bg-blue-600', 'text-white');
    editorBtn.classList.remove('bg-gray-200');
    questionsBtn.classList.remove('bg-blue-600', 'text-white');
    questionsBtn.classList.add('bg-gray-200');
    archiveBtn.classList.remove('bg-blue-600', 'text-white');
    archiveBtn.classList.add('bg-gray-200');
  }

  function showQuestions() {
    console.log('Showing questions view...');
    questionsView.classList.remove('hidden');
    editorView.classList.add('hidden');
    archiveView.classList.add('hidden');
    questionsBtn.classList.add('bg-blue-600', 'text-white');
    questionsBtn.classList.remove('bg-gray-200');
    editorBtn.classList.remove('bg-blue-600', 'text-white');
    editorBtn.classList.add('bg-gray-200');
    archiveBtn.classList.remove('bg-blue-600', 'text-white');
    archiveBtn.classList.add('bg-gray-200');
    loadOpen();
    loadAnswered();
  }

  function updateOpenCount(num) {
    if (openCountSpan) openCountSpan.textContent = num;
  }

  function showArchive() {
    console.log('Showing archive view...');
    archiveView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsView.classList.add('hidden');
    archiveBtn.classList.add('bg-blue-600', 'text-white');
    archiveBtn.classList.remove('bg-gray-200');
    editorBtn.classList.remove('bg-blue-600', 'text-white');
    editorBtn.classList.add('bg-gray-200');
    questionsBtn.classList.remove('bg-blue-600', 'text-white');
    questionsBtn.classList.add('bg-gray-200');
    loadArchive();
  }

  editorBtn.addEventListener('click', showEditor);
  questionsBtn.addEventListener('click', showQuestions);
  archiveBtn.addEventListener('click', showArchive);
  exportBtn.addEventListener('click', async () => {
    try {
      console.log('Exporting data...');
      const res = await fetch('/api/export', { headers: { 'x-session-token': sessionStorage.getItem('sessionToken') } });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'export.json';
        a.click();
        URL.revokeObjectURL(url);
        const statsRes = await fetch('/api/stats', { headers: { 'x-session-token': sessionStorage.getItem('sessionToken') } });
        if (statsRes.ok) {
          const s = await statsRes.json();
          alert('Gesamt: ' + s.total);
        } else {
          console.error('Stats fetch failed:', await statsRes.json());
        }
      } else {
        console.error('Export fetch failed:', await res.json());
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      console.log('Logging out...');
      await fetch('/api/logout', { headers: { 'x-session-token': sessionStorage.getItem('sessionToken') } });
      sessionStorage.removeItem('sessionToken');
      sessionStorage.removeItem('userRole');
      window.location.href = '/login/login.html';
    } catch (err) {
      console.error('Logout error:', err);
    }
  });

  console.log('Setting up question tabs...');
  const tabOpen = document.getElementById('tab-open');
  const tabAnswered = document.getElementById('tab-answered');
  const openList = document.getElementById('open-list');
  const answeredList = document.getElementById('answered-list');
  const questionSearch = document.getElementById('question-search');

  function showOpen() {
    console.log('Showing open questions...');
    openList.classList.remove('hidden');
    answeredList.classList.add('hidden');
    tabOpen.classList.add('bg-blue-600', 'text-white');
    tabAnswered.classList.remove('bg-blue-600', 'text-white');
    tabAnswered.classList.add('bg-gray-200');
    tabOpen.classList.remove('bg-gray-200');
  }

  function showAnswered() {
    console.log('Showing answered questions...');
    answeredList.classList.remove('hidden');
    openList.classList.add('hidden');
    tabAnswered.classList.add('bg-blue-600', 'text-white');
    tabOpen.classList.remove('bg-blue-600', 'text-white');
    tabOpen.classList.add('bg-gray-200');
    tabAnswered.classList.remove('bg-gray-200');
  }

  tabOpen.addEventListener('click', showOpen);
  tabAnswered.addEventListener('click', showAnswered);
  questionSearch.addEventListener('input', () => {
    console.log('Question search input changed...');
    loadOpen();
    loadAnswered();
  });

  async function loadOpen() {
    openList.innerHTML = '';
    try {
      console.log('Fetching unanswered questions...');
      const res = await fetch('/api/unanswered', {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(`HTTP error ${res.status}: ${error.error || 'Unknown error'}`);
      }
      const questions = await res.json();
      console.log('Unanswered questions received:', questions);
      if (!Array.isArray(questions)) {
        console.error('Expected array, got:', questions);
        openList.innerHTML = '<div>Keine Fragen verfügbar</div>';
        return;
      }
      const qFilter = questionSearch.value.toLowerCase();
      updateOpenCount(questions.length);
      questions.filter(q => !qFilter || q.toLowerCase().includes(qFilter)).forEach(q => {
        const div = document.createElement('div');
        div.className = 'border p-4 rounded';
        const form = document.createElement('form');
        form.innerHTML = `
          <p class="mb-2 font-medium">${q}</p>
          <input type="hidden" name="question" value="${q}">
          <input name="editor" class="border p-2 w-full mb-2" placeholder="Name" required>
          <input name="answer" class="border p-2 w-full mb-2" placeholder="Antwort" required>
          <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Senden</button>
        `;
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const data = { question: q, answer: form.answer.value, editor: form.editor.value };
          try {
            console.log('Submitting answer:', data);
            const resp = await fetch('/api/answer', {
              method: 'POST',
              headers: {
                'x-session-token': sessionStorage.getItem('sessionToken'),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            });
            if (resp.ok) {
              div.remove();
              updateOpenCount(Math.max(0, parseInt(openCountSpan.textContent) - 1));
            } else {
              console.error('Answer submission failed:', await resp.json());
            }
          } catch (err) {
            console.error('Answer submission error:', err);
          }
        });
        div.appendChild(form);
        openList.appendChild(div);
      });
    } catch (err) {
      openList.innerHTML = '<div>Fehler beim Laden</div>';
      console.error('Error loading unanswered questions:', err);
    }
  }

  async function loadAnswered() {
    answeredList.innerHTML = '';
    try {
      console.log('Fetching answered questions...');
      const res = await fetch('/api/answered', {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(`HTTP error ${res.status}: ${error.error || 'Unknown error'}`);
      }
      const pairs = await res.json();
      console.log('Answered questions received:', pairs);
      if (!Array.isArray(pairs)) {
        console.error('Expected array, got:', pairs);
        answeredList.innerHTML = '<div>Keine Antworten verfügbar</div>';
        return;
      }
      const qFilter = questionSearch.value.toLowerCase();
      pairs.filter(p => !qFilter || p.question.toLowerCase().includes(qFilter)).forEach(p => {
        const div = document.createElement('div');
        div.className = 'border p-4 rounded';
        const form = document.createElement('form');
        form.innerHTML = `
          <p class="mb-2 font-medium">${p.question}</p>
          <input type="hidden" name="question" value="${p.question}">
          <input name="editor" class="border p-2 w-full mb-2" placeholder="Name" required>
          <input name="answer" class="border p-2 w-full mb-2" value="${p.answer}" required>
          <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Aktualisieren</button>
        `;
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const data = { question: p.question, answer: form.answer.value, editor: form.editor.value };
          try {
            console.log('Updating answer:', data);
            const resp = await fetch('/api/update', {
              method: 'POST',
              headers: {
                'x-session-token': sessionStorage.getItem('sessionToken'),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            });
            if (!resp.ok) {
              console.error('Answer update failed:', await resp.json());
            }
          } catch (err) {
            console.error('Answer update error:', err);
          }
        });
        div.appendChild(form);
        answeredList.appendChild(div);
      });
    } catch (err) {
      answeredList.innerHTML = '<div>Fehler beim Laden</div>';
      console.error('Error loading answered questions:', err);
    }
  }

  console.log('Setting up editor...');
  const listEl = document.getElementById('headline-list');
  const searchEl = document.getElementById('search');
  let editor;
  try {
    console.log('Initializing Toast UI Editor...');
    editor = new toastui.Editor({
      el: document.getElementById('editor'),
      height: '100%',
      initialEditType: 'wysiwyg',
      previewStyle: 'vertical',
      toolbarItems: [
        ['heading', 'bold', 'italic', 'link', 'image'],
        [{
          name: 'underline',
          tooltip: 'Underline',
          action: (editor) => {
            const range = editor.getCurrentRange();
            const selectedText = editor.getSelectedText();
            editor.replaceSelection('__' + selectedText + '__');
          },
          text: 'U',
          className: 'toastui-editor-toolbar-icons',
          style: { textDecoration: 'underline' }
        }]
      ]
    });
    console.log('Toast UI Editor initialized');
  } catch (e) {
    console.error('Failed to initialize Toast UI Editor:', e);
    alert('Editor initialization failed: ' + e.message);
  }
  const addBtn = document.getElementById('add-heading');
  const archiveList = document.getElementById('archive-list');
  const archiveSearch = document.getElementById('archive-search');
  const archiveSort = document.getElementById('archive-sort');
  const headlineInput = document.getElementById('headline-input');
  const editorNameInput = document.getElementById('editor-name');
  const activeCheckbox = document.getElementById('active-toggle');
  const saveBtn = document.getElementById('save-btn');
  const deleteBtn = document.getElementById('delete-btn');

  let currentId = null;
  let allHeadlines = [];
  let archiveEntries = [];

  async function loadHeadlines() {
    console.log('Fetching headlines...');
    try {
      const q = encodeURIComponent(searchEl.value.trim());
      const res = await fetch('/api/headlines?q=' + q, {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(`HTTP error ${res.status}: ${error.error || 'Unknown error'}`);
      }
      allHeadlines = await res.json();
      console.log('Headlines received:', allHeadlines);
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
      li.addEventListener('click', () => loadEntry(h.id));
      listEl.appendChild(li);
    });
  }

  async function loadEntry(id) {
    try {
      console.log('Fetching entry:', id);
      const res = await fetch(`/api/entries/${id}`, {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(`HTTP error ${res.status}: ${error.error || 'Unknown error'}`);
      }
      const entry = await res.json();
      console.log('Entry received:', entry);
      currentId = entry.id;
      headlineInput.value = entry.headline;
      editorNameInput.value = entry.editor || '';
      editor.setMarkdown(entry.text);
      activeCheckbox.checked = !!entry.active;
    } catch (err) {
      console.error('Failed to load entry:', err);
    }
  }

  async function saveEntry() {
    const payload = {
      headline: headlineInput.value.trim(),
      text: editor.getMarkdown().trim(),
      active: activeCheckbox.checked,
      editor: editorNameInput.value.trim()
    };
    if (!payload.headline || !payload.text) return;
    try {
      console.log('Saving entry:', payload);
      let res;
      if (currentId) {
        res = await fetch(`/api/entries/${currentId}`, {
          method: 'PUT',
          headers: {
            'x-session-token': sessionStorage.getItem('sessionToken'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/entries', {
          method: 'POST',
          headers: {
            'x-session-token': sessionStorage.getItem('sessionToken'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
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
      alert('Gespeichert');
    } catch (err) {
      console.error('Failed to save entry:', err);
      alert('Failed to save entry: ' + err.message);
    }
  }

  async function deleteEntry() {
    if (!currentId) return;
    try {
      console.log('Deleting entry:', currentId);
      const res = await fetch(`/api/entries/${currentId}`, {
        method: 'DELETE',
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(`HTTP error ${res.status}: ${error.error || 'Unknown error'}`);
      }
      console.log('Entry deleted');
      currentId = null;
      headlineInput.value = '';
      editorNameInput.value = '';
      editor.setMarkdown('');
      activeCheckbox.checked = false;
      await loadHeadlines();
      alert('Gelöscht');
    } catch (err) {
      console.error('Failed to delete entry:', err);
      alert('Failed to delete entry: ' + err.message);
    }
  }

  saveBtn.addEventListener('click', saveEntry);
  deleteBtn.addEventListener('click', deleteEntry);
  addBtn.addEventListener('click', () => {
    console.log('Adding new heading...');
    currentId = null;
    headlineInput.value = '';
    editorNameInput.value = '';
    editor.setMarkdown('');
    activeCheckbox.checked = true;
  });

  async function loadArchive() {
    archiveEntries = [];
    archiveList.innerHTML = '';
    try {
      console.log('Fetching archive...');
      const res = await fetch('/api/archive', {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(`HTTP error ${res.status}: ${error.error || 'Unknown error'}`);
      }
      archiveEntries = await res.json();
      console.log('Archive received:', archiveEntries);
      if (!Array.isArray(archiveEntries)) archiveEntries = [];
      renderArchive();
    } catch (err) {
      archiveList.innerHTML = '<div>Fehler beim Laden</div>';
      console.error('Failed to load archive:', err);
    }
  }

  function renderArchive() {
    console.log('Rendering archive:', archiveEntries);
    let items = archiveEntries.slice();
    const q = archiveSearch.value.toLowerCase();
    if (q) {
      items = items.filter(e =>
        e.headline.toLowerCase().includes(q) ||
        (e.text && e.text.toLowerCase().includes(q)) ||
        (e.editor && e.editor.toLowerCase().includes(q))
      );
    }
    const sort = archiveSort.value;
    if (sort === 'oldest') {
      items.sort((a, b) => new Date(a.archived) - new Date(b.archived));
    } else if (sort === 'editor') {
      items.sort((a, b) => (a.editor || '').localeCompare(b.editor || ''));
    } else {
      items.sort((a, b) => new Date(b.archived) - new Date(a.archived));
    }
    archiveList.innerHTML = '';
    items.forEach(e => {
      const div = document.createElement('div');
      div.className = 'border p-4 rounded';
      const date = e.archived ? new Date(e.archived).toLocaleString() : '';
      div.innerHTML = `<h3 class="font-semibold mb-1">${e.headline}</h3>
        <p class="text-sm text-gray-500 mb-2">${date} - ${e.editor || ''}</p>
        <div class="text-sm mb-2">${e.text}</div>`;
      const btn = document.createElement('button');
      btn.className = 'px-2 py-1 bg-blue-500 text-white rounded mr-2';
      btn.textContent = 'Wiederherstellen';
      btn.addEventListener('click', async () => {
        const name = prompt('Name des Editors?');
        if (name === null) return;
        try {
          console.log('Restoring entry:', e.id);
          await fetch(`/api/restore/${e.id}`, {
            method: 'POST',
            headers: {
              'x-session-token': sessionStorage.getItem('sessionToken'),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ editor: name })
          });
          await loadHeadlines();
          alert('Wiederhergestellt');
        } catch (err) {
          console.error('Restore failed:', err);
        }
      });
      div.appendChild(btn);
      archiveList.appendChild(div);
    });
  }

  console.log('Adding search and archive listeners...');
  searchEl.addEventListener('input', () => {
    console.log('Search input changed, loading headlines...');
    loadHeadlines();
  });
  archiveSearch.addEventListener('input', renderArchive);
  archiveSort.addEventListener('change', renderArchive);

  console.log('Calling showEditor...');
  showEditor();
  console.log('Calling loadOpen...');
  loadOpen();
  console.log('Calling loadHeadlines...');
  loadHeadlines();
});