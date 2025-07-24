import { fetchAndParse } from './utils.js';

export function initQuestions({ openMoveModal, updateOpenCount, showEditor }) {
  const tabOpen = document.getElementById('tab-open');
  const tabAnswered = document.getElementById('tab-answered');
  const openList = document.getElementById('open-list');
  const answeredList = document.getElementById('answered-list');
  const questionSearch = document.getElementById('question-search');
  const deleteSelectedBtn = document.getElementById('delete-selected');
  const openCountSpan = document.getElementById('open-count');
  const btnEditQuestions = document.getElementById('btn-edit-questions');

  let selectedQuestions = new Set();

  async function loadOpen() {
    openList.innerHTML = '';
    selectedQuestions.clear();
    deleteSelectedBtn.classList.add('hidden');
    try {
      const questions = await fetchAndParse('/api/admin/unanswered');
      if (!Array.isArray(questions)) {
        openList.innerHTML = '<div class="text-gray-500">Keine offenen Fragen gefunden.</div>';
        return;
      }
      const qFilter = questionSearch.value.toLowerCase();
      updateOpenCount(questions.length);
      questions.filter(q => !qFilter || q.question.toLowerCase().includes(qFilter)).forEach(q => {
        const div = document.createElement('div');
        div.className = 'border border-[var(--border-color)] p-4 rounded-lg';

        const header = document.createElement('div');
        header.className = 'flex justify-between items-start mb-2';

        const left = document.createElement('div');
        left.className = 'flex items-start space-x-3';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'mt-1 h-4 w-4 text-[var(--accent-color)] focus:ring-[var(--accent-color)] border-[var(--input-border)] rounded';
        cb.addEventListener('change', () => {
          if (cb.checked) selectedQuestions.add(q.question); else selectedQuestions.delete(q.question);
          deleteSelectedBtn.classList.toggle('hidden', selectedQuestions.size === 0);
        });

        const textContainer = document.createElement('div');
        const p = document.createElement('p');
        p.className = 'font-medium';
        p.textContent = q.question;
        textContainer.appendChild(p);

        if (q.translation) {
          const t = document.createElement('p');
          t.className = 'text-sm text-[var(--secondary-text)] mt-1';
          t.textContent = `(Übersetzung: ${q.translation})`;
          textContainer.appendChild(t);
        }
        
        left.appendChild(cb);
        left.appendChild(textContainer);

        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '🗑️';
        del.className = 'text-gray-400 hover:text-red-600 transition-colors';
        del.addEventListener('click', () => handleDelete([q.question]));

        header.appendChild(left);
        header.appendChild(del);

        div.appendChild(header);

        const form = document.createElement('form');
        form.innerHTML = `
          <input type="hidden" name="question" value="${q.question}">
          <!--
          <textarea name="answer" class="border border-[var(--input-border)] p-2 w-full mb-2 rounded-md" placeholder="Antwort hier eingeben..." required rows="3"></textarea>
          <button class="btn-primary px-4 py-2 rounded-md" type="submit">Antworten</button>
          -->
          <button type="button" class="px-4 py-2 rounded-md text-white btn-edit-question" style="background-color: cornflowerblue;">Bearbeiten</button>
        `;
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const data = { question: q.question, answer: form.answer.value };
          try {
            const resp = await fetch('/api/admin/answer', {
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

        const editButton = form.querySelector('.btn-edit-question');
        editButton.addEventListener('click', () => {
            document.getElementById('question-edit-label').textContent = q.question;
            document.getElementById('question-edit-id').value = q.question;
            document.getElementById('question-edit-banner').classList.remove('hidden');
            showEditor();
        });

        div.appendChild(form);
        openList.appendChild(div);
      });
    } catch (err) {
      openList.innerHTML = '<div class="text-red-500">Fehler beim Laden der offenen Fragen.</div>';
      console.error('Error loading unanswered questions:', err);
    }
  }

  async function handleDelete(questions) {
    if (!questions || questions.length === 0) return;
    const text = questions.length === 1
      ? `Soll die folgende Frage wirklich gelöscht werden?\n\n"${questions[0]}"`
      : `Sollen ${questions.length} Fragen wirklich gelöscht werden?`;
    if (!confirm(text)) return;
    try {
      const resp = await fetch('/api/admin/unanswered', {
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
      const pairs = await fetchAndParse('/api/admin/answered');
      if (!Array.isArray(pairs)) {
        answeredList.innerHTML = '<div class="text-gray-500">Keine beantworteten Fragen gefunden.</div>';
        return;
      }
      const qFilter = questionSearch.value.toLowerCase();
      pairs.filter(p => !qFilter || p.question.toLowerCase().includes(qFilter)).forEach(p => {
        const div = document.createElement('div');
        div.className = 'border border-[var(--border-color)] p-4 rounded-lg';
        const form = document.createElement('form');
        form.innerHTML = `
          <p class="mb-2 font-medium">${p.question}</p>
          <input type="hidden" name="question" value="${p.question}">
          <input name="answer" class="border border-[var(--input-border)] p-2 w-full mb-2 rounded-md" value="${p.answer}" required>
          <div class="flex space-x-2">
            <button class="btn-primary px-4 py-2 rounded-md" type="submit">Aktualisieren</button>
            <button type="button" class="btn-secondary px-4 py-2 rounded-md move-btn">In Wissen verschieben</button>
          </div>
        `;
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const data = { question: p.question, answer: form.answer.value };
          try {
            const resp = await fetch('/api/admin/update', {
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
      answeredList.innerHTML = '<div class="text-red-500">Fehler beim Laden der beantworteten Fragen.</div>';
      console.error('Error loading answered questions:', err);
    }
  }

  function showOpen() {
    openList.classList.remove('hidden');
    answeredList.classList.add('hidden');
    tabOpen.classList.remove('btn-secondary');
    tabOpen.classList.add('btn-primary');
    tabAnswered.classList.remove('btn-primary');
    tabAnswered.classList.add('btn-secondary');
    selectedQuestions.clear();
    deleteSelectedBtn.classList.add('hidden');
    loadOpen();
  }

  function showAnswered() {
    answeredList.classList.remove('hidden');
    openList.classList.add('hidden');
    tabAnswered.classList.remove('btn-secondary');
    tabAnswered.classList.add('btn-primary');
    tabOpen.classList.remove('btn-primary');
    tabOpen.classList.add('btn-secondary');
    loadAnswered();
  }

  

  tabOpen.addEventListener('click', showOpen);
  tabAnswered.addEventListener('click', showAnswered);
  questionSearch.addEventListener('input', () => {
    if (!openList.classList.contains('hidden')) {
        loadOpen();
    }
    if (!answeredList.classList.contains('hidden')) {
        loadAnswered();
    }
  });
  deleteSelectedBtn.addEventListener('click', () => handleDelete(Array.from(selectedQuestions)));

  // Initial state
  showOpen();

  return { loadOpen, loadAnswered };
}