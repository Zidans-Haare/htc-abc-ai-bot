/**
 * Helper function to handle fetch, parse JSON responses, and handle errors.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options.
 * @returns {Promise<any>} - The parsed JSON response.
 */
export async function fetchAndParse(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    let errorMessage = 'Unknown error';
    try {
      const error = await res.json();
      errorMessage = error.error || errorMessage;
    } catch (e) {
      errorMessage = await res.text() || errorMessage;
    }
    throw new Error(`HTTP error ${res.status}: ${errorMessage}`);
  }
  return res.json();
}

/**
 * Overrides the global fetch to automatically handle 401 Unauthorized errors
 * by redirecting to the login page.
 */
export function overrideFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    init.credentials = 'include'; // Ensure credentials are always included
    const res = await originalFetch(input, init);
    if (res.status === 401) {
      console.error('Unauthorized request:', input);
      sessionStorage.removeItem('userRole');
      alert('Session abgelaufen, bitte erneut anmelden');
      window.location.href = '/login/login.html';
    }
    return res;
  };
}
