document.addEventListener('DOMContentLoaded', async () => {
  console.log('Login page loaded, initializing...');
  const loginForm = document.getElementById('login-form');
  const userInput = document.getElementById('login-user');
  const passInput = document.getElementById('login-pass');

  async function doLogin(u, p) {
    console.log('Attempting login with username:', u);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Login successful, role:', data.role);
        sessionStorage.setItem('userRole', data.role); // Nur Rolle speichern
         window.location.href = '/admin';
      } else {
        const error = await res.json();
        console.error('Login failed:', error);
        alert('Login fehlgeschlagen: ' + (error.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Login error: ' + err.message);
    }
  }

  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    doLogin(userInput.value, passInput.value);
  });

  // Prüfe, ob eine gültige Sitzung existiert
  try {
    const res = await fetch('/api/validate');
    if (res.ok) {
      console.log('Session valid, redirecting to admin...');
      window.location.href = '/admin/index.html';
    } else {
      console.log('No valid session, staying on login page...');
      sessionStorage.removeItem('userRole');
    }
  } catch (err) {
    console.error('Validation error:', err);
    sessionStorage.removeItem('userRole');
  }
});