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
});
