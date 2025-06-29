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
        console.log('Login successful, token:', data.token);
        sessionStorage.setItem('sessionToken', data.token);
        sessionStorage.setItem('userRole', data.role);
        window.location.href = `/admin/index.html?sessionToken=${encodeURIComponent(data.token)}`;
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

  console.log('Checking for existing session token:', sessionStorage.getItem('sessionToken'));
  const token = sessionStorage.getItem('sessionToken');
  if (token) {
    try {
      const res = await fetch(`/api/validate?sessionToken=${encodeURIComponent(token)}`, {
        headers: { 'x-session-token': token }
      });
      if (res.ok) {
        console.log('Session token valid, redirecting to admin...');
        window.location.href = `/admin/index.html?sessionToken=${encodeURIComponent(token)}`;
      } else {
        console.log('Session token invalid, clearing session...');
        sessionStorage.removeItem('sessionToken');
        sessionStorage.removeItem('userRole');
      }
    } catch (err) {
      console.error('Validation error:', err);
      sessionStorage.removeItem('sessionToken');
      sessionStorage.removeItem('userRole');
    }
  }
});