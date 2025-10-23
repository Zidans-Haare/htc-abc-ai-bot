import '../styles/tailwind-backend.css';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Login page loaded, initializing...');
  const loginForm = document.getElementById('login-form');
  const userInput = document.getElementById('login-user');
  const passInput = document.getElementById('login-pass');
  const loginTitle = document.getElementById('login-title');

  const allowedRedirectPrefixes = ['/admin', '/dash', '/api/docs'];

  const resolveRedirectTarget = (target) => {
    if (target && allowedRedirectPrefixes.some(prefix => target.startsWith(prefix))) {
      return target;
    }
    return '/admin';
  };

  // Set dynamic title based on redirect parameter
  const urlParams = new URLSearchParams(window.location.search);
  const redirectTo = urlParams.get('redirect');
  if (redirectTo && redirectTo.startsWith('/dash')) {
    loginTitle.textContent = 'Dashboard Login';
    document.title = 'Login - Dashboard';
  } else if (redirectTo && redirectTo.startsWith('/admin')) {
    loginTitle.textContent = 'Admin Login';
    document.title = 'Login - Hochschul ABC Management';
  } else if (redirectTo && redirectTo.startsWith('/api/docs')) {
    loginTitle.textContent = 'API-Dokumentation Login';
    document.title = 'Login - API Docs';
  } else {
    loginTitle.textContent = 'Login';
    document.title = 'Login';
  }

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

        // Check for redirect parameter
        const redirectTarget = resolveRedirectTarget(urlParams.get('redirect'));
        window.location.href = redirectTarget;
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
      console.log('Session valid, redirecting...');
      // Check for redirect parameter even for existing sessions
      const redirectTarget = resolveRedirectTarget(urlParams.get('redirect'));
      window.location.href = redirectTarget;
    } else {
      console.log('No valid session, staying on login page...');
      sessionStorage.removeItem('userRole');
    }
  } catch (err) {
    console.error('Validation error:', err);
    sessionStorage.removeItem('userRole');
  }
});
