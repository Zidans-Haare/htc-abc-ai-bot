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
  users.forEach(user => {
    const userElement = document.createElement('div');
    userElement.className = 'flex items-center justify-between p-2 border-b';
    userElement.innerHTML = `
      <span>${user.username} (${user.role})</span>
      <div>
        <button class="change-password-btn px-2 py-1 bg-yellow-500 text-white rounded mr-2" data-username="${user.username}">Passwort ändern</button>
        <button class="remove-user-btn px-2 py-1 bg-red-500 text-white rounded" data-username="${user.username}">Löschen</button>
      </div>
    `;
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
