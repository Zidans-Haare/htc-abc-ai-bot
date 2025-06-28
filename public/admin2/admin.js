
document.addEventListener('DOMContentLoaded', () => {
  const loginScreen = document.getElementById('login-screen');
  const loginForm = document.getElementById('login-form');
  const userInput = document.getElementById('login-user');
  const passInput = document.getElementById('login-pass');

  async function doLogin(u,p){
    const res = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
    if(res.ok){
      const data=await res.json();
      sessionStorage.setItem('sessionToken',data.token);
      sessionStorage.setItem('userRole', data.role);
      loginScreen.classList.add('hidden');
      init();
    }else{alert('Login fehlgeschlagen');}
  }

  loginForm.addEventListener('submit',e=>{e.preventDefault();doLogin(userInput.value,passInput.value);});

  if(sessionStorage.getItem('sessionToken')){
    loginScreen.classList.add('hidden');
    init();
  }

  function init() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    init.headers = init.headers || {};
    const token = sessionStorage.getItem('sessionToken');
    if (token) {
      init.headers['x-session-token'] = token;
    }
    const res = await originalFetch(input, init);
    if (res.status === 401) {
      sessionStorage.removeItem('sessionToken');
      alert('Session abgelaufen, bitte erneut anmelden');
      location.reload();
    }
    return res;
  }; 

  if(sessionStorage.getItem('userRole')==='admin'){
    document.getElementById('user-admin').classList.remove('hidden');
    document.getElementById('create-user').addEventListener('click', async () => {
      const u = document.getElementById('new-user').value.trim();
      const p = document.getElementById('new-pass').value.trim();
      const r = document.getElementById('new-role').value;
      if(!u||!p) return;
      await fetch('/api/admin/users', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-session-token':sessionStorage.getItem('sessionToken')},
        body: JSON.stringify({username:u,password:p,role:r})
      });
      alert('User created');
    });
  }
  // Tabs for switching between editor and question management
  const editorBtn = document.getElementById('btn-editor');
  const questionsBtn = document.getElementById('btn-questions');
  const archiveBtn = document.getElementById('btn-archive');
  const exportBtn = document.getElementById('btn-export');

  const openCountSpan = document.getElementById('open-count');


  const editorView = document.getElementById('editor-view');
  const questionsView = document.getElementById('questions-view');
  const archiveView = document.getElementById('archive-view');

  function showEditor() {
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
    const res = await fetch('/api/admin/export', { headers: { 'x-session-token': sessionStorage.getItem('sessionToken') }});
    if(res.ok){
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'export.json';
      a.click();
      URL.revokeObjectURL(url);
      const statsRes = await fetch('/api/admin/stats', { headers: { 'x-session-token': sessionStorage.getItem('sessionToken') }});
      if(statsRes.ok){
        const s = await statsRes.json();
        alert('Gesamt:'+s.total); // simple stats display
      }
    }
  });

  // Question management logic (copied from public/admin/index.html)
  const tabOpen = document.getElementById('tab-open');
  const tabAnswered = document.getElementById('tab-answered');
  const openList = document.getElementById('open-list');
  const answeredList = document.getElementById('answered-list');
  const questionSearch = document.getElementById('question-search');

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
  questionSearch.addEventListener('input', () => { loadOpen(); loadAnswered(); });

  async function loadOpen() {
    openList.innerHTML = '';
    try {
      const res = await fetch('/api/unanswered', {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      const questions = await res.json();
      if (!Array.isArray(questions)) return;
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
          }
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
      const res = await fetch('/api/answered', {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      const pairs = await res.json();
      if (!Array.isArray(pairs)) return;
      const qFilter = questionSearch.value.toLowerCase();
      pairs.filter(p=>!qFilter || p.question.toLowerCase().includes(qFilter)).forEach(p => {
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
          await fetch('/api/update', {
            method: 'POST',
            headers: {
              'x-session-token': sessionStorage.getItem('sessionToken'),
              'Content-Type': 'application/json'
            },
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
  loadOpen();






  const listEl = document.getElementById('headline-list');
  const searchEl = document.getElementById('search');
  const quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: '#quill-toolbar',
      table: true,
      syntax: true
    }
  });
  const addBtn = document.getElementById('add-heading');
  const pane = document.getElementById('editor-pane');
  const archiveList = document.getElementById('archive-list');
  const archiveSearch = document.getElementById('archive-search');
  const archiveSort = document.getElementById('archive-sort');



  const headlineInput = document.getElementById('headline-input');
  const editorNameInput = document.getElementById('editor-name');

  const activeCheckbox = document.getElementById('active-toggle');
  const saveBtn = document.getElementById('save-btn');
  const deleteBtn = document.getElementById('delete-btn');
  deleteBtn.disabled = true;

  let currentId = null;
  let allHeadlines = [];
  let archiveEntries = [];

  async function loadHeadlines() {
    try {
      const q = encodeURIComponent(searchEl.value.trim());
      const res = await fetch('/api/admin/headlines?q='+q, {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
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
      li.className = 'p-2 hover:bg-gray-100 rounded flex justify-between items-center';

      const span = document.createElement('span');
      span.textContent = h.headline;
      span.className = 'cursor-pointer flex-grow';
      span.addEventListener('click', () => loadEntry(h.id));
      li.appendChild(span);

      const link = document.createElement('a');
      link.href = '#';
      link.className = 'text-blue-600 text-sm ml-2';
      link.textContent = '↗';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPreview(h.id);
      });
      li.appendChild(link);

      listEl.appendChild(li);
    });
  }

  async function loadEntry(id) {
    try {
      const res = await fetch(`/api/admin/entries/${id}`, {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) return;
      const entry = await res.json();
      currentId = entry.id;
      headlineInput.value = entry.headline;
      editorNameInput.value = entry.editor || '';
      quill.root.innerHTML = entry.text;
      activeCheckbox.checked = !!entry.active;
      deleteBtn.disabled = false;
    } catch (err) {
      console.error('Failed to load entry', err);
    }
  }

  async function saveEntry() {
    const payload = {
      headline: headlineInput.value.trim(),
      text: quill.root.innerHTML.trim(),
      active: activeCheckbox.checked,
      editor: editorNameInput.value.trim()
    };
    if (!payload.headline || !payload.text) {
      alert('\u00dcberschrift und Text werden benötigt');
      return;
    }
    try {
      let res;
      if (currentId) {
        res = await fetch(`/api/admin/entries/${currentId}`, {
          method: 'PUT',
          headers: {
            'x-session-token': sessionStorage.getItem('sessionToken'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/admin/entries', {
          method: 'POST',
          headers: {
            'x-session-token': sessionStorage.getItem('sessionToken'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }
      if (res.ok) {
        const data = await res.json();
        currentId = data.id;
        await loadHeadlines();
        deleteBtn.disabled = false;
        alert('Gespeichert');
      }
    } catch (err) {
      console.error('Failed to save entry', err);
      alert('Speichern fehlgeschlagen');
    }
  }

  async function deleteEntry() {
    if (!currentId) return;
    if (!confirm('Eintrag wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/admin/entries/${currentId}`, {
        method: 'DELETE',
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        currentId = null;
        headlineInput.value = '';
        editorNameInput.value = '';
        quill.root.innerHTML = '';
        activeCheckbox.checked = false;
        deleteBtn.disabled = true;
        await loadHeadlines();
        alert('Gelöscht');
      }
    } catch (err) {
      console.error('Failed to delete entry', err);
      alert('Löschen fehlgeschlagen');

    }
  }

  async function openPreview(id) {
    try {
      const res = await fetch(`/api/admin/entries/${id}`, {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) return;
      const entry = await res.json();
      const w = window.open('', '_blank');
      w.document.write(`<h1>${entry.headline}</h1>` + entry.text);
    } catch (err) {
      console.error('Preview failed', err);
    }
  }

  saveBtn.addEventListener('click', saveEntry);
  deleteBtn.addEventListener('click', deleteEntry);
  addBtn.addEventListener('click', () => {
    currentId = null;
    headlineInput.value = '';
    editorNameInput.value = '';
    quill.root.innerHTML = '';
    activeCheckbox.checked = true;
    deleteBtn.disabled = true;
  });

  async function loadArchive() {
    archiveEntries = [];
    archiveList.innerHTML = '';
    try {
      const res = await fetch('/api/admin/archive', {
        headers: {
          'x-session-token': sessionStorage.getItem('sessionToken'),
          'Content-Type': 'application/json'
        }
      });
      archiveEntries = await res.json();
      if (!Array.isArray(archiveEntries)) archiveEntries = [];
      renderArchive();
    } catch (err) {
      archiveList.innerHTML = '<div>Fehler beim Laden</div>';
      console.error('Failed to load archive', err);
    }
  }


  function renderArchive() {
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
      items.sort((a,b) => new Date(a.archived) - new Date(b.archived));
    } else if (sort === 'editor') {
      items.sort((a,b) => (a.editor||'').localeCompare(b.editor||''));
    } else {
      items.sort((a,b) => new Date(b.archived) - new Date(a.archived));
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
        await fetch(`/api/admin/restore/${e.id}`, {
          method: 'POST',
          headers: {
            'x-session-token': sessionStorage.getItem('sessionToken'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ editor: name })
        });
        await loadHeadlines();
        alert('Wiederhergestellt');
      });
      const diffBtn = document.createElement('button');
      diffBtn.className = 'px-2 py-1 bg-gray-500 text-white rounded';
      diffBtn.textContent = 'Diff';
      diffBtn.addEventListener('click', () => {
        const active = allHeadlines.find(h => h.headline === e.headline);
        const current = active ? active.text : '';
        const w = window.open('', '_blank');
        w.document.body.innerHTML = diffText(current, e.text);
      });
      div.appendChild(btn);
      div.appendChild(diffBtn);
      archiveList.appendChild(div);
    });
  }

  function diffText(a,b){
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(a,b);
    dmp.diff_cleanupSemantic(diffs);
    return diffs.map(d=>{
      if(d[0]===0) return d[1];
      if(d[0]===-1) return '<del>'+d[1]+'</del>';
      return '<ins>'+d[1]+'</ins>';
    }).join('');
  }


  searchEl.addEventListener('input', () => { loadHeadlines(); });

  archiveSearch.addEventListener('input', renderArchive);
  archiveSort.addEventListener('change', renderArchive);

  loadHeadlines();
  }

});
