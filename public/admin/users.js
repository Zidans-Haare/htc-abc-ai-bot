import { fetchAndParse } from './utils.js';

async function loadUsers() {
  try {
    const users = await fetchAndParse('/api/admin/users');
    renderUsers(users);
  } catch (error) {
    console.error('Failed to load users:', error);
    document.getElementById('user-list').innerHTML = '<div>Fehler beim Laden der Benutzer.</div>';
  }
}

function renderUsers(users) {
  const userListDiv = document.getElementById('user-list');
  userListDiv.innerHTML = '';
  if (users.length === 0) {
    userListDiv.innerHTML = '<p class="text-[var(--secondary-text)]">Keine Benutzer gefunden.</p>';
    return;
  }
  users.forEach(user => {
    const userElement = document.createElement('div');
    userElement.className = 'flex items-center justify-between p-3 border-b border-[var(--border-color)]';
    
    const userInfo = document.createElement('div');
    userInfo.innerHTML = `
      <p class="font-medium">${user.username}</p>
      <p class="text-sm text-[var(--secondary-text)]">${user.role}</p>
    `;

    const userActions = document.createElement('div');
    userActions.className = 'flex items-center space-x-2';
    userActions.innerHTML = `
      <button class="change-password-btn btn-secondary px-3 py-2 rounded-md flex items-center space-x-2" data-username="${user.username}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2h2l1.743-1.743A6 6 0 0119 9z" /></svg>
        <span>Passwort</span>
      </button>
      <button class="remove-user-btn bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md flex items-center space-x-2" data-username="${user.username}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        <span>Löschen</span>
      </button>
    `;
    
    userElement.appendChild(userInfo);
    userElement.appendChild(userActions);
    userListDiv.appendChild(userElement);
  });

  document.querySelectorAll('.change-password-btn').forEach(button => {
    button.addEventListener('click', handleChangePassword);
  });
  document.querySelectorAll('.remove-user-btn').forEach(button => {
    button.addEventListener('click', handleRemoveUser);
  });
}

async function handleChangePassword(event) {
  const username = event.target.dataset.username;
  const newPassword = prompt(`Neues Passwort für ${username}:`);
  if (newPassword && newPassword.trim() !== '') {
    try {
      const response = await fetch(`/api/admin/users/${username}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      if (response.ok) {
        alert('Passwort erfolgreich geändert.');
      } else {
        const error = await response.json();
        alert(`Fehler beim Ändern des Passworts: ${error.error || 'Unbekannter Fehler'}`);
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Fehler beim Ändern des Passworts.');
    }
  }
}

async function handleRemoveUser(event) {
  const username = event.target.dataset.username;
  if (confirm(`Benutzer ${username} wirklich löschen?`)) {
    try {
      const response = await fetch(`/api/admin/users/${username}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert('Benutzer erfolgreich gelöscht.');
        loadUsers(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Fehler beim Löschen des Benutzers: ${error.error || 'Unbekannter Fehler'}`);
      }
    } catch (error) {
      console.error('Error removing user:', error);
      alert('Fehler beim Löschen des Benutzers.');
    }
  }
}

function initUsers() {
    document.getElementById('create-user').addEventListener('click', async () => {
        const u = document.getElementById('new-user').value.trim();
        const p = document.getElementById('new-pass').value.trim();
        const r = document.getElementById('new-role').value;
        if (!u || !p) return;
        try {
          const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p, role: r }),
          });
          if (res.ok) {
            alert('User created');
            document.getElementById('new-user').value = '';
            document.getElementById('new-pass').value = '';
            loadUsers();
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

export { initUsers, loadUsers };
