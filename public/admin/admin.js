import { fetchAndParse, overrideFetch } from './utils.js';
import { initHeadlines, allHeadlines, loadHeadlines, selectHeadline, getCurrentId, loadEntry, saveEntry } from './articles.js';
import { initQuestions } from './questions.js';
import { initUsers, loadUsers } from './users.js';
import { initArchive, loadArchive } from './archive.js';
import { initExport } from './export.js';
import { setupFeedback } from './feedback.js';
import { renderMarkup } from '../js/markup.js';
import { initImages } from './images.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Admin page loaded, initializing...');

  overrideFetch();

  // Validate session
  try {
    const session = await fetchAndParse('/api/validate');
    document.getElementById('last-edited-by').innerHTML = `last edit by:<br>`;
    if (!sessionStorage.getItem('userRole')) {
        sessionStorage.setItem('userRole', session.role);
    }
    // Display logged in user info
    const userSessionInfo = document.getElementById('user-session-info');
    if (userSessionInfo && session.username) {
        userSessionInfo.innerHTML = `Angemeldet als:<br><strong class="font-medium text-[var(--primary-text)]">${session.username}</strong>`;
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
  const imagesBtn = document.getElementById('btn-images');
  const conversationsBtn = document.getElementById('btn-conversations');

  const editorView = document.getElementById('editor-view');
  const questionsView = document.getElementById('questions-view');
  const archiveView = document.getElementById('archive-view');
  const userView = document.getElementById('user-view');
  const feedbackView = document.getElementById('feedback-view');
  const imagesView = document.getElementById('images-view');
  const conversationsView = document.getElementById('conversations-view');
  
  const openCountSpan = document.getElementById('open-count');
  
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');

  // --- Sidebar Toggle Logic ---
  function setSidebarState(collapsed) {
    if (collapsed) {
      sidebar.classList.add('collapsed');
      sidebarToggleIcon.classList.remove('fa-chevron-left');
      sidebarToggleIcon.classList.add('fa-chevron-right');
    } else {
      sidebar.classList.remove('collapsed');
      sidebarToggleIcon.classList.remove('fa-chevron-right');
      sidebarToggleIcon.classList.add('fa-chevron-left');
    }
  }

  sidebarToggle.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    setSidebarState(isCollapsed);
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  });

  // Check for saved sidebar state
  const savedSidebarState = localStorage.getItem('sidebarCollapsed') === 'true';
  setSidebarState(savedSidebarState);

  // --- View Switching Logic ---
  function showEditor() {
    editorView.classList.remove('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userView.classList.add('hidden');
    feedbackView.classList.add('hidden');
    imagesView.classList.add('hidden');
    if (conversationsView) conversationsView.classList.add('hidden');
    updateButtonStyles(editorBtn);
  }

  function showQuestions() {
    questionsView.classList.remove('hidden');
    editorView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userView.classList.add('hidden');
    feedbackView.classList.add('hidden');
    imagesView.classList.add('hidden');
    if (conversationsView) conversationsView.classList.add('hidden');
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
    imagesView.classList.add('hidden');
    if (conversationsView) conversationsView.classList.add('hidden');
    updateButtonStyles(archiveBtn);
    loadArchive();
  }

  function showUserAdmin() {
    userView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    feedbackView.classList.add('hidden');
    imagesView.classList.add('hidden');
    if (conversationsView) conversationsView.classList.add('hidden');
    updateButtonStyles(userBtn);
    loadUsers();
  }

  function showFeedback() {
    feedbackView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userView.classList.add('hidden');
    imagesView.classList.add('hidden');
    if (conversationsView) conversationsView.classList.add('hidden');
    updateButtonStyles(feedbackBtn);
  }

  function showImages() {
    imagesView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userView.classList.add('hidden');
    feedbackView.classList.add('hidden');
    if (conversationsView) conversationsView.classList.add('hidden');
    updateButtonStyles(imagesBtn);
  }

  function showConversations() {
    if (conversationsView) conversationsView.classList.remove('hidden');
    editorView.classList.add('hidden');
    questionsView.classList.add('hidden');
    archiveView.classList.add('hidden');
    userView.classList.add('hidden');
    feedbackView.classList.add('hidden');
    imagesView.classList.add('hidden');
    updateButtonStyles(conversationsBtn);
  }

  function updateButtonStyles(activeButton) {
    const buttons = [editorBtn, questionsBtn, archiveBtn, userBtn, feedbackBtn, exportBtn, imagesBtn, conversationsBtn];
    buttons.forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    if (activeButton) activeButton.classList.add('active');
  }

  // --- Role-based UI Setup ---
  const userRole = sessionStorage.getItem('userRole');

  // Hide all role-dependent buttons by default
  editorBtn.classList.add('hidden');
  questionsBtn.classList.add('hidden');
  archiveBtn.classList.add('hidden');
  userBtn.classList.add('hidden');
  feedbackBtn.classList.add('hidden');
  if(imagesBtn) imagesBtn.classList.add('hidden');
  if(conversationsBtn) conversationsBtn.classList.add('hidden');

  switch (userRole) {
    case 'admin':
      editorBtn.classList.remove('hidden');
      questionsBtn.classList.remove('hidden');
      archiveBtn.classList.remove('hidden');
      userBtn.classList.remove('hidden');
      feedbackBtn.classList.remove('hidden');
      if(imagesBtn) imagesBtn.classList.remove('hidden');
      if(conversationsBtn) conversationsBtn.classList.remove('hidden');
      
      editorBtn.addEventListener('click', showEditor);
      questionsBtn.addEventListener('click', showQuestions);
      archiveBtn.addEventListener('click', showArchive);
      userBtn.addEventListener('click', showUserAdmin);
      feedbackBtn.addEventListener('click', showFeedback);
      if(imagesBtn) imagesBtn.addEventListener('click', showImages);
      
      initUsers();
      showEditor();
      break;
    case 'editor':
      editorBtn.classList.remove('hidden');
      questionsBtn.classList.remove('hidden');
      archiveBtn.classList.remove('hidden');
      if(imagesBtn) imagesBtn.classList.remove('hidden');

      editorBtn.addEventListener('click', showEditor);
      questionsBtn.addEventListener('click', showQuestions);
      archiveBtn.addEventListener('click', showArchive);
      if(imagesBtn) imagesBtn.addEventListener('click', showImages);

      showEditor();
      break;
    case 'entwickler':
      feedbackBtn.classList.remove('hidden');
      exportBtn.classList.remove('hidden');
      if(conversationsBtn) conversationsBtn.classList.remove('hidden');

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
      imagesView.classList.add('hidden');
      if(conversationsView) conversationsView.classList.add('hidden');
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
  const questionsManager = initQuestions({ updateOpenCount, showEditor });
  initArchive();
  initExport();
  setupFeedback();
  initImages();
  if (window.initConversations) {
    initConversations(showConversations);
  }
  
  document.addEventListener('update-username', (e) => {
    const currentUserSpan = document.getElementById('last-edited-by');
    if (currentUserSpan) {
      currentUserSpan.innerHTML = `last edit by:<br>${e.detail.username}`;
    }
  });

  // --- AI Response Modal Logic ---
  const aiResponseModal = document.getElementById('ai-response-modal');
  const aiResponseClose = document.getElementById('ai-response-close');
  const testAiResponseBtn = document.getElementById('test-ai-response');
  const aiPrompt = document.getElementById('ai-prompt');
  const aiResponse = document.getElementById('ai-response');

  testAiResponseBtn.addEventListener('click', async () => {
    const saveBtn = document.getElementById('save-btn');
    if (!saveBtn.disabled) {
      await saveEntry();
    }

    const questionId = document.getElementById('question-edit-id').value;
    const articleId = getCurrentId();

    if (questionId && articleId) {
      try {
        await fetch('/api/admin/questions/link-article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId, articleId }),
        });
        const headline = document.getElementById('headline-input').value;
        const answeredInDiv = document.getElementById('question-answered-in');
        if (answeredInDiv) {
            answeredInDiv.innerHTML = `<strong>Beantwortet in:</strong> ${headline}`;
            answeredInDiv.style.display = 'block';
        }
        await loadEntry(articleId);
      } catch (err) {
        console.error('Failed to link article:', err);
      }
    }

    const question = document.getElementById('question-edit-label').textContent;
    aiPrompt.textContent = question;
    aiResponse.textContent = 'Lade...';
    aiResponseModal.classList.remove('hidden');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: question }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      aiResponse.innerHTML = ''; // Clear previous content

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        
        // Process buffer line by line
        let boundary = buffer.lastIndexOf('\n');
        if (boundary === -1) continue; // Wait for a full line

        const lines = buffer.substring(0, boundary).split('\n');
        buffer = buffer.substring(boundary + 1);

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonString = line.substring(6);
                if (jsonString === '[DONE]') {
                    continue;
                }
                try {
                    const json = JSON.parse(jsonString);
                    if (json.token) {
                        fullResponse += json.token;
                        aiResponse.innerHTML = renderMarkup(fullResponse);
                    }
                } catch (e) {
                    console.error('Failed to parse stream chunk:', e, 'Chunk:', jsonString);
                }
            }
        }
      }
      // Enable the button after the test is complete
      const markAsAnsweredBtn = document.getElementById('mark-as-answered-btn');
      markAsAnsweredBtn.disabled = false;
      markAsAnsweredBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
      markAsAnsweredBtn.classList.add('btn-primary');

    } catch (error) {
      aiResponse.textContent = 'Fehler beim Abrufen der AI-Antwort.';
      console.error('Error fetching AI response:', error);
    }
  });

  aiResponseClose.addEventListener('click', () => {
    aiResponseModal.classList.add('hidden');
  });

  const cancelEditBtn = document.getElementById('cancel-edit-question');
  cancelEditBtn.addEventListener('click', () => {
    document.getElementById('question-edit-banner').classList.add('hidden');
    document.getElementById('question-context-actions').classList.add('hidden');
    document.getElementById('delete-btn').classList.remove('hidden');
    document.getElementById('save-btn').classList.remove('hidden');
  });
});
