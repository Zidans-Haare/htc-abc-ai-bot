import { fetchAndParse, overrideFetch } from './utils.js';
import { initHeadlines, allHeadlines, loadHeadlines } from './headlines.js';
import { initQuestions } from './questions.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Admin page loaded, initializing...');

  overrideFetch();

  // Validate session
  try {
    await fetchAndParse('/api/validate');
    document.getElementById('current-user').innerHTML = `last edit by:<br>`;
  } catch (err) {
    console.error('Validation error:', err);
    sessionStorage.removeItem('userRole');
    window.location.href = '/login/login.html';
    return;
  }

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p, role: r }),
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
  const exportModal = document.getElementById('export-modal');
  const exportJsonBtn = document.getElementById('export-json');
  const exportPdfBtn = document.getElementById('export-pdf');
  const exportCancelBtn = document.getElementById('export-cancel');
  const moveModal = document.getElementById('move-modal');
  const moveSelect = document.getElementById('move-select');
  const moveNew = document.getElementById('move-new');
  const moveConfirm = document.getElementById('move-confirm');
  const moveCancel = document.getElementById('move-cancel');
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
  exportBtn.addEventListener('click', () => {
    exportModal.classList.remove('hidden');
  });

  exportCancelBtn.addEventListener('click', () => {
    exportModal.classList.add('hidden');
  });

  exportJsonBtn.addEventListener('click', () => handleExport('json'));
  exportPdfBtn.addEventListener('click', () => handleExport('pdf'));

  async function handleExport(type) {
    exportModal.classList.add('hidden');
    try {
      console.log('Exporting data...', type);
      const data = await fetchAndParse('/api/export');
      if (type === 'pdf') {
        if (!window.jspdf) {
          alert('PDF Export nicht verfügbar');
          return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const text = JSON.stringify(data, null, 2);
        const lines = doc.splitTextToSize(text, 180);
        doc.text(lines, 10, 10);
        doc.save('export.pdf');
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'export.json';
        a.click();
        URL.revokeObjectURL(url);
      }
      const stats = await fetchAndParse('/api/stats');
      alert('Gesamt: ' + stats.total);
    } catch (err) {
      console.error('Export error:', err);
    }
  }

  logoutBtn.addEventListener('click', async () => {
    try {
      console.log('Logging out...');
      await fetchAndParse('/api/logout', { method: 'POST' });
      sessionStorage.removeItem('userRole');
      window.location.href = '/login/login.html';
    } catch (err) {
      console.error('Logout error:', err);
    }
  });

  let archiveEntries = [];
  const archiveList = document.getElementById('archive-list');
  const archiveSearch = document.getElementById('archive-search');
  const archiveSort = document.getElementById('archive-sort');

  let moveData = null;

  async function openMoveModal(question, answer) {
    moveData = { question, answer };
    await loadHeadlines();
    moveSelect.innerHTML = '<option value="">Überschrift wählen...</option>';
    allHeadlines.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = h.headline;
      moveSelect.appendChild(opt);
    });
    moveNew.value = '';
    moveModal.classList.remove('hidden');
  }

  moveCancel.addEventListener('click', () => {
    moveModal.classList.add('hidden');
  });

  moveConfirm.addEventListener('click', async () => {
    if (!moveData) return;
    const payload = {
      question: moveData.question,
      answer: moveData.answer,
      headlineId: moveSelect.value || null,
      newHeadline: moveNew.value.trim()
    };
    if (!payload.headlineId && !payload.newHeadline) {
      alert('Bitte Überschrift wählen oder neu eingeben');
      return;
    }
    try {
      const resp = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        moveModal.classList.add('hidden');
        const { loadAnswered } = initQuestions({ openMoveModal, updateOpenCount });
        loadAnswered();
        await loadHeadlines();
      } else {
        console.error('Move failed:', await resp.json());
      }
    } catch (err) {
      console.error('Move error:', err);
    }
  });

  async function loadArchive() {
    archiveEntries = [];
    archiveList.innerHTML = '';
    try {
      console.log('Fetching archive...');
      archiveEntries = await fetchAndParse('/api/archive');
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
        try {
          console.log('Restoring entry:', e.id);
          const resp = await fetch(`/api/restore/${e.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (resp.ok) {
            await loadHeadlines();
            await loadArchive();
            alert('Wiederhergestellt');
          } else {
            console.error('Restore failed:', await resp.json());
          }
        } catch (err) {
          console.error('Restore failed:', err);
        }
      });
      div.appendChild(btn);
      archiveList.appendChild(div);
    });
  }

  archiveSearch.addEventListener('input', renderArchive);
  archiveSort.addEventListener('change', renderArchive);

  console.log('Calling showEditor...');
  showEditor();
  console.log('Initializing questions...');
  initQuestions({ openMoveModal, updateOpenCount });
  console.log('Initializing headlines...');
  initHeadlines();
});
