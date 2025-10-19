import { fetchAndParse } from './utils.js';

const createBackupBtn = document.getElementById('create-backup-btn');
const uploadBackupBtn = document.getElementById('upload-backup-btn');
const uploadBackupInput = document.getElementById('upload-backup-input');
const backupCreate = document.getElementById('backup-create');
const startBackupBtn = document.getElementById('start-backup-btn');
const backupList = document.getElementById('backup-list');

const checkboxes = {
  users: document.getElementById('backup-users'),
  artikels: document.getElementById('backup-artikels'),
  fragen: document.getElementById('backup-fragen'),
  conversations: document.getElementById('backup-conversations'),
  dokumente: document.getElementById('backup-dokumente'),
  bilder: document.getElementById('backup-bilder'),
  feedback: document.getElementById('backup-feedback'),
  dashboard: document.getElementById('backup-dashboard')
};

function initBackup() {
  createBackupBtn.addEventListener('click', () => {
    backupCreate.classList.remove('hidden');
  });

  uploadBackupBtn.addEventListener('click', () => {
    uploadBackupInput.click();
  });

  uploadBackupInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await fetch('/api/admin/backup/upload', {
        method: 'POST',
        body: formData
      });
      loadBackups();
    } catch (err) {
      console.error('Upload failed', err);
    }
  });

  startBackupBtn.addEventListener('click', async function() {
    const selected = {};
    Object.keys(checkboxes).forEach(key => {
      selected[key] = checkboxes[key].checked;
    });
    startBackupBtn.disabled = true;
    startBackupBtn.textContent = 'Creating Backup...';
    try {
      const res = await fetch('/api/admin/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected)
      });
      if (res.status === 409) {
        alert('Backup already in progress');
        return;
      }
      const { filename, status, message } = await res.json();
      alert(message || `Backup ${status}: ${filename}`);
      backupCreate.classList.add('hidden');
      loadBackups();
    } catch (err) {
      console.error('Backup failed', err);
    } finally {
      startBackupBtn.disabled = false;
      startBackupBtn.textContent = 'Start Backup';
    }
  });

  loadBackups();
}

async function loadBackups() {
  try {
    const backups = await fetchAndParse('/api/admin/backup/list');
    backupList.innerHTML = '';
    backups.forEach(backup => {
      const item = document.createElement('div');
      item.className = 'flex justify-between items-center p-2 border rounded';
      item.innerHTML = `
        <span>${backup.filename} (${new Date(backup.date).toLocaleString()}) - ${(backup.size / 1024 / 1024).toFixed(2)} MB</span>
        <div class="space-x-2">
          <button class="download-btn px-2 py-1 bg-blue-500 text-white rounded" data-filename="${backup.filename}">Download</button>
          <button class="rename-btn px-2 py-1 bg-yellow-500 text-white rounded" data-filename="${backup.filename}">Rename</button>
          <button class="import-btn px-2 py-1 bg-green-500 text-white rounded" data-filename="${backup.filename}">Import</button>
          <button class="delete-btn px-2 py-1 bg-red-500 text-white rounded" data-filename="${backup.filename}">Delete</button>
        </div>
      `;
      backupList.appendChild(item);
    });

    // Add event listeners
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.open(`/backup/${btn.dataset.filename}`);
      });
    });

    document.querySelectorAll('.rename-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newName = prompt('New name:', btn.dataset.filename);
        if (newName) {
          await fetch(`/api/admin/backup/${btn.dataset.filename}/rename`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName })
          });
          loadBackups();
        }
      });
    });

    document.querySelectorAll('.import-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const mode = prompt('Import mode: replace, append-override, append-keep');
        if (mode) {
          await fetch(`/api/admin/backup/${btn.dataset.filename}/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
          });
          alert('Import completed');
        }
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this backup?')) {
          await fetch(`/api/admin/backup/${btn.dataset.filename}`, { method: 'DELETE' });
          loadBackups();
        }
      });
    });
  } catch (err) {
    console.error('Load backups failed', err);
  }
}

export { initBackup };