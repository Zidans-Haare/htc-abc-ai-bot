import { fetchAndParse, overrideFetch } from './utils.js';
import { initHeadlines, allHeadlines, loadHeadlines } from './headlines.js';
import { initQuestions } from './questions.js';
import { initUsers, loadUsers } from './users.js';
import { initArchive, loadArchive } from './archive.js';
import { initExport } from './export.js';
import { setupFeedback } from './feedback.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Admin page loaded, initializing...');

  overrideFetch();

  // Validate session
  try {
    const session = await fetchAndParse('/api/validate');
    document.getElementById('current-user').innerHTML = `last edit by:<br>`;
    if (!sessionStorage.getItem('userRole')) {
        sessionStorage.setItem('userRole', session.role);
    }
  } catch (err) {
    console.error('Validation error:', err);
    sessionStorage.removeItem('userRole');
    window.location.href = '/login/login.html';
    return;
  }

  // --- Get DOM Elements ---
  const editorBtn = document.getElementById('btn-editor');
  const questionsBtn = document.getElementById('btn-questions');
  const archiveBtn = document.getElementById('btn-archive');
  const userBtn = document.getElementById('btn-user');
  const feedbackBtn = document.getElementById('btn-feedback');
  const exportBtn = document.getElementById('btn-export');
  const logoutBtn = document.getElementById('btn-logout');

  const editorView = document.getElementById('editor-view');
  const questionsView = document.getElementById('questions-view');
  const archiveView = document.getElementById('archive-view');
  const userView = document.getElementById('user-view');
  const feedbackView = document.getElementById('feedback-view');
  
  const openCountSpan = document.getElementById('open-count');
  
  const moveModal = document.getElementById('move-modal');
  const moveSelect = document.getElementById('move-select');
  const moveNew = document.getElementById('move-new');
  const moveConfirm = document.getElementById('move-confirm');
  const moveCancel = document.getElementById('move-cancel');

  // --- View Switching Logic ---
  function showEditor() {
    editorView.classList.remove('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userView.classList.add('hidden');
    feedbackView.classList.add('hidden');
    updateButtonStyles(editorBtn);
  }

  function showQuestions() {
    questionsView.classList.remove('hidden');
    editorView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userView.classList.add('hidden');
    feedbackView.classList.add('hidden');
    updateButtonStyles(questionsBtn);
  }
  
  function updateOpenCount(num) {
    if (openCountSpan) openCountSpan.textContent = num;
  }

  function showArchive() {
    archiveView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsView.classList.add('hidden');
    userView.classList.add('hidden');
    feedbackView.classList.add('hidden');
    updateButtonStyles(archiveBtn);
    loadArchive();
  }

  function showUserAdmin() {
    userView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    feedbackView.classList.add('hidden');
    updateButtonStyles(userBtn);
    loadUsers();
  }

  function showFeedback() {
    feedbackView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userView.classList.add('hidden');
    updateButtonStyles(feedbackBtn);
  }

  function updateButtonStyles(activeButton) {
    const buttons = [editorBtn, questionsBtn, archiveBtn, userBtn, feedbackBtn, exportBtn];
    buttons.forEach(btn => {
      btn.classList.remove('bg-blue-600', 'text-white');
      btn.classList.add('bg-gray-200');
    });
    activeButton.classList.add('bg-blue-600', 'text-white');
    activeButton.classList.remove('bg-gray-200');
  }

  // --- Role-based UI Setup ---
  const userRole = sessionStorage.getItem('userRole');

  // Hide all role-dependent buttons by default
  editorBtn.classList.add('hidden');
  questionsBtn.classList.add('hidden');
  archiveBtn.classList.add('hidden');
  userBtn.classList.add('hidden');
  feedbackBtn.classList.add('hidden');

  switch (userRole) {
    case 'admin':
      editorBtn.classList.remove('hidden');
      questionsBtn.classList.remove('hidden');
      archiveBtn.classList.remove('hidden');
      userBtn.classList.remove('hidden');
      feedbackBtn.classList.remove('hidden');
      
      editorBtn.addEventListener('click', showEditor);
      questionsBtn.addEventListener('click', showQuestions);
      archiveBtn.addEventListener('click', showArchive);
      userBtn.addEventListener('click', showUserAdmin);
      feedbackBtn.addEventListener('click', showFeedback);
      
      initUsers();
      showEditor();
      break;
    case 'editor':
      editorBtn.classList.remove('hidden');
      questionsBtn.classList.remove('hidden');
      archiveBtn.classList.remove('hidden');

      editorBtn.addEventListener('click', showEditor);
      questionsBtn.addEventListener('click', showQuestions);
      archiveBtn.addEventListener('click', showArchive);

      showEditor();
      break;
    case 'entwickler':
      feedbackBtn.classList.remove('hidden');
      exportBtn.classList.remove('hidden');

      feedbackBtn.addEventListener('click', showFeedback);
      
      showFeedback();
      break;
    default:
      // Fallback for unknown roles
      editorView.classList.add('hidden');
      questionsView.classList.add('hidden');
      archiveView.classList.add('hidden');
      userView.classList.add('hidden');
      feedbackView.classList.add('hidden');
      break;
  }

  // --- Always-on Event Listeners & Initializations ---
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetchAndParse('/api/logout', { method: 'POST' });
      sessionStorage.removeItem('userRole');
      window.location.href = '/login/login.html';
    } catch (err) {
      console.error('Logout error:', err);
    }
  });

  // Initialize all modules
  initHeadlines();
  initQuestions({ openMoveModal, updateOpenCount });
  initArchive();
  initExport();
  setupFeedback();

  // --- Modal Logic ---
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

  moveCancel.addEventListener('click', () => moveModal.classList.add('hidden'));

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
  
  document.addEventListener('update-username', (e) => {
    const currentUserSpan = document.getElementById('current-user');
    if (currentUserSpan) {
      currentUserSpan.innerHTML = `last edit by:<br>${e.detail.username}`;
    }
  });
});