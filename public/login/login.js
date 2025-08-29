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
        if (data.role === 'admin') {
          window.location.href = '/admin/';
        } else {
          alert('Zugriff verweigert: Sie haben keine Berechtigung, auf den Admin-Bereich zuzugreifen.');
        }
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

  // Check for a valid session
  try {
    const res = await fetch('/api/validate');
    if (res.ok) {
      const data = await res.json();
      if (data.role === 'admin') {
        console.log('Session valid and user is admin, redirecting to admin area...');
        window.location.href = '/admin/';
      } else {
        console.log('Session valid but user is not admin, staying on login page.');
      }
    } else {
      console.log('No valid session, staying on login page...');
    }
  } catch (err) {
    console.error('Validation error:', err);
  }
});