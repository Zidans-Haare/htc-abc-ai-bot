const listeners = new Set();

let authState = {
  isAuthenticated: false,
  role: null,
  username: null,
  profile: null,
  loading: false,
};

function notify() {
  const snapshot = { ...authState, profile: authState.profile ? { ...authState.profile } : null };
  listeners.forEach(listener => {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('Auth listener failed:', err);
    }
  });
}

function setState(partial) {
  authState = { ...authState, ...partial };
  notify();
}

export function onAuthChange(listener) {
  if (typeof listener === 'function') {
    listeners.add(listener);
    listener({ ...authState, profile: authState.profile ? { ...authState.profile } : null });
  }
  return () => listeners.delete(listener);
}

function handleResponse(response) {
  if (!response.ok) {
    return response.json().catch(() => ({})).then(err => {
      const error = new Error(err.error || 'Anfrage fehlgeschlagen');
      error.details = err.details;
      throw error;
    });
  }
  return response.json();
}

export async function initSession() {
  setState({ loading: true });
  try {
    const res = await fetch('/api/validate', {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Nicht angemeldet');
    }
    const data = await res.json();
    setState({
      isAuthenticated: true,
      role: data.role || null,
      username: data.username || null,
      profile: data.profile || null,
      loading: false,
    });
    return data.profile;
  } catch (err) {
    setState({
      isAuthenticated: false,
      role: null,
      username: null,
      profile: null,
      loading: false,
    });
    return null;
  }
}

export async function login({ email, password }) {
  const payload = { username: email, password };
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(res);
  setState({
    isAuthenticated: true,
    role: data.role || null,
    username: email,
    profile: data.profile || null,
  });
  return data.profile;
}

export async function register({ email, password, displayName }) {
  const payload = { email, password, displayName };
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  setState({
    isAuthenticated: true,
    role: data.role || null,
    username: email,
    profile: data.profile || null,
  });
  return data.profile;
}

export async function logout() {
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'include',
  });
  setState({
    isAuthenticated: false,
    role: null,
    username: null,
    profile: null,
  });
}

export async function fetchProfile() {
  const res = await fetch('/api/profile', {
    method: 'GET',
    credentials: 'include',
  });
  const data = await handleResponse(res);
  setState({
    isAuthenticated: true,
    profile: data.profile || null,
  });
  return data.profile;
}

export async function updateProfile(patch) {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const data = await handleResponse(res);
  setState({
    isAuthenticated: true,
    profile: data.profile || null,
  });
  return data.profile;
}

export function getAuthState() {
  return { ...authState, profile: authState.profile ? { ...authState.profile } : null };
}
