import { fetchAndParse, overrideFetch } from './utils.js';
import { initHeadlines, allHeadlines, loadHeadlines } from './headlines.js';
import { initQuestions } from './questions.js';
import { initUsers, loadUsers } from './users.js';
import { initArchive, loadArchive } from './archive.js';
import { initExport } from './export.js';

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

  console.log('Adding event listeners for navigation...');
  const editorBtn = document.getElementById('btn-editor');
  const questionsBtn = document.getElementById('btn-questions');
  const archiveBtn = document.getElementById('btn-archive');
  const userBtn = document.getElementById('btn-user');
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
  const userView = document.getElementById('user-view');

  function showEditor() {
    console.log('Showing editor view...');
    editorView.classList.remove('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userView.classList.add('hidden');
    editorBtn.classList.add('bg-blue-600', 'text-white');
    editorBtn.classList.remove('bg-gray-200');
    questionsBtn.classList.remove('bg-blue-600', 'text-white');
    questionsBtn.classList.add('bg-gray-200');
    archiveBtn.classList.remove('bg-blue-600', 'text-white');
    archiveBtn.classList.add('bg-gray-200');
    userBtn.classList.remove('bg-blue-600', 'text-white');
    userBtn.classList.add('bg-gray-200');
  }

  function showQuestions() {
    console.log('Showing questions view...');
    questionsView.classList.remove('hidden');
    editorView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userView.classList.add('hidden');
    questionsBtn.classList.add('bg-blue-600', 'text-white');
    questionsBtn.classList.remove('bg-gray-200');
    editorBtn.classList.remove('bg-blue-600', 'text-white');
    editorBtn.classList.add('bg-gray-200');
    archiveBtn.classList.remove('bg-blue-600', 'text-white');
    archiveBtn.classList.add('bg-gray-200');
    userBtn.classList.remove('bg-blue-600', 'text-white');
    userBtn.classList.add('bg-gray-200');
  }

  function updateOpenCount(num) {
    if (openCountSpan) openCountSpan.textContent = num;
  }

  function showArchive() {
    console.log('Showing archive view...');
    archiveView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsView.classList.add('hidden');
    userView.classList.add('hidden');
    archiveBtn.classList.add('bg-blue-600', 'text-white');
    archiveBtn.classList.remove('bg-gray-200');
    editorBtn.classList.remove('bg-blue-600', 'text-white');
    editorBtn.classList.add('bg-gray-200');
    questionsBtn.classList.remove('bg-blue-600', 'text-white');
    questionsBtn.classList.add('bg-gray-200');
    userBtn.classList.remove('bg-blue-600', 'text-white');
    userBtn.classList.add('bg-gray-200');
    loadArchive();
  }

  function showUserAdmin() {
    console.log('Showing user admin view...');
    userView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userBtn.classList.add('bg-blue-600', 'text-white');
    userBtn.classList.remove('bg-gray-200');
    editorBtn.classList.remove('bg-blue-600', 'text-white');
    editorBtn.classList.add('bg-gray-200');
    questionsBtn.classList.remove('bg-blue-600', 'text-white');
    questionsBtn.classList.add('bg-gray-200');
    archiveBtn.classList.remove('bg-blue-600', 'text-white');
    archiveBtn.classList.add('bg-gray-200');
    loadUsers();
  }

  if (sessionStorage.getItem('userRole') === 'admin') {
    console.log('Admin role detected, enabling admin features.');
    userBtn.classList.remove('hidden');
    userBtn.addEventListener('click', showUserAdmin);
    initUsers();
  }

  editorBtn.addEventListener('click', showEditor);
  questionsBtn.addEventListener('click', showQuestions);
  archiveBtn.addEventListener('click', showArchive);

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

  console.log('Calling showEditor...');
  showEditor();
  console.log('Initializing questions...');
  initQuestions({ openMoveModal, updateOpenCount });
  console.log('Initializing headlines...');
  initHeadlines();
  console.log('Initializing archive...');
  initArchive();
  console.log('Initializing export...');
  initExport();
});