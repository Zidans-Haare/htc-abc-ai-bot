import { fetchAndParse } from './utils.js';
import { loadHeadlines } from './articles.js';

let archiveEntries = [];
const archiveList = document.getElementById('archive-list');
const archiveSearch = document.getElementById('archive-search');
const archiveSort = document.getElementById('archive-sort');

async function loadArchive() {
  archiveEntries = [];
  archiveList.innerHTML = '';
  try {
    console.log('Fetching archive...');
    archiveEntries = await fetchAndParse('/api/admin/archive');
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
    btn.className = 'btn-primary px-3 py-1 rounded-md mr-2';
    btn.textContent = 'Wiederherstellen';
    btn.addEventListener('click', async () => {
      try {
        console.log('Restoring entry:', e.id);
        const resp = await fetch(`/api/admin/restore/${e.id}`, {
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

function initArchive() {
    archiveSearch.addEventListener('input', renderArchive);
    archiveSort.addEventListener('change', renderArchive);
}

export { initArchive, loadArchive };
