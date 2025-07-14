import { fetchAndParse } from './utils.js';

export function initQuestions({ openMoveModal, updateOpenCount }) {
  const tabOpen = document.getElementById('tab-open');
  const tabAnswered = document.getElementById('tab-answered');
  const openList = document.getElementById('open-list');
  const answeredList = document.getElementById('answered-list');
  const questionSearch = document.getElementById('question-search');
  const deleteSelectedBtn = document.getElementById('delete-selected');
  const openCountSpan = document.getElementById('open-count');

  let selectedQuestions = new Set();

  async function loadOpen() {
    openList.innerHTML = '';
    selectedQuestions.clear();
    deleteSelectedBtn.classList.add('hidden');
    try {
      console.log('Fetching unanswered questions...');
      const questions = await fetchAndParse('/api/unanswered');
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

        const header = document.createElement('div');
        header.className = 'flex justify-between items-start mb-2';

        const left = document.createElement('div');
        left.className = 'flex items-start space-x-2';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'mt-1';
        cb.addEventListener('change', () => {
          if (cb.checked) selectedQuestions.add(q); else selectedQuestions.delete(q);
          deleteSelectedBtn.classList.toggle('hidden', selectedQuestions.size === 0);
        });

        const p = document.createElement('p');
        p.className = 'font-medium';
        p.textContent = q;

        left.appendChild(cb);
        left.appendChild(p);

        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '🗑️';
        del.addEventListener('click', () => handleDelete([q]));

        header.appendChild(left);
        header.appendChild(del);

        div.appendChild(header);

        const form = document.createElement('form');
        form.innerHTML = `
          <input type="hidden" name="question" value="${q}">
          <input name="answer" class="border p-2 w-full mb-2" placeholder="Antwort" required>
          <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Senden</button>
        `;
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const data = { question: q, answer: form.answer.value };
          try {
            console.log('Submitting answer:', data);
            const resp = await fetch('/api/answer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            if (resp.ok) {
              div.remove();
              updateOpenCount(Math.max(0, parseInt(openCountSpan.textContent) - 1));
              loadAnswered();
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

  async function handleDelete(questions) {
    if (!questions || questions.length === 0) return;
    const text = questions.length === 1
      ? `Frage wirklich löschen?\n${questions[0]}`
      : `Fragen wirklich löschen?\n${questions.join('\n')}`;
    if (!confirm(text)) return;
    try {
      const resp = await fetch('/api/unanswered', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });
      if (resp.ok) {
        selectedQuestions.clear();
        deleteSelectedBtn.classList.add('hidden');
        loadOpen();
      } else {
        console.error('Delete failed:', await resp.json());
      }
    } catch (err)
    {
      console.error('Delete error:', err);
    }
  }

  async function loadAnswered() {
    answeredList.innerHTML = '';
    try {
      console.log('Fetching answered questions...');
      const pairs = await fetchAndParse('/api/answered');
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
          <input name="answer" class="border p-2 w-full mb-2" value="${p.answer}" required>
          <div class="flex space-x-2">
            <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Aktualisieren</button>
            <button type="button" class="bg-green-600 text-white px-4 py-2 rounded move-btn">In Wissen verschieben</button>
          </div>
        `;
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const data = { question: p.question, answer: form.answer.value };
          try {
            console.log('Updating answer:', data);
            const resp = await fetch('/api/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            if (!resp.ok) {
              console.error('Answer update failed:', await resp.json());
            }
          } catch (err) {
            console.error('Answer update error:', err);
          }
        });
        form.querySelector('.move-btn').addEventListener('click', () => {
          openMoveModal(p.question, form.answer.value);
        });
        div.appendChild(form);
        answeredList.appendChild(div);
      });
    } catch (err) {
      answeredList.innerHTML = '<div>Fehler beim Laden</div>';
      console.error('Error loading answered questions:', err);
    }
  }

  function showOpen() {
    console.log('Showing open questions...');
    openList.classList.remove('hidden');
    answeredList.classList.add('hidden');
    tabOpen.classList.add('bg-blue-600', 'text-white');
    tabAnswered.classList.remove('bg-blue-600', 'text-white');
    tabAnswered.classList.add('bg-gray-200');
    tabOpen.classList.remove('bg-gray-200');
    selectedQuestions.clear();
    deleteSelectedBtn.classList.add('hidden');
    loadOpen();
  }

  function showAnswered() {
    console.log('Showing answered questions...');
    answeredList.classList.remove('hidden');
    openList.classList.add('hidden');
    tabAnswered.classList.add('bg-blue-600', 'text-white');
    tabOpen.classList.remove('bg-blue-600', 'text-white');
    tabOpen.classList.add('bg-gray-200');
    tabAnswered.classList.remove('bg-gray-200');
    loadAnswered();
  }

  console.log('Setting up question tabs...');
  tabOpen.addEventListener('click', showOpen);
  tabAnswered.addEventListener('click', showAnswered);
  questionSearch.addEventListener('input', () => {
    console.log('Question search input changed...');
    loadOpen();
    loadAnswered();
  });
  deleteSelectedBtn.addEventListener('click', () => handleDelete(Array.from(selectedQuestions)));

  // Initial state
  showOpen();

  return { loadOpen, loadAnswered };
}