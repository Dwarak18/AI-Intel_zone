// ==============================================================================
// API Client — base fetch wrapper with JWT auth
// ==============================================================================

const BASE_URL = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('arena_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    // Token expired — clear and redirect
    localStorage.removeItem('arena_token');
    localStorage.removeItem('arena_user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('arena_user') || 'null');
  } catch {
    return null;
  }
}

export function setAuth(token, user) {
  localStorage.setItem('arena_token', token);
  localStorage.setItem('arena_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('arena_token');
  localStorage.removeItem('arena_user');
}
