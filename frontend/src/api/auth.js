import { apiFetch, setAuth, clearAuth } from './client.js';

export async function loginAdmin(username, password) {
  const data = await apiFetch('/auth/api/token', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setAuth(data.token, data.user);
  return data;
}

export async function loginTeam(teamCode, password) {
  const data = await apiFetch('/auth/api/team-token', {
    method: 'POST',
    body: JSON.stringify({ team_code: teamCode, password }),
  });
  setAuth(data.token, { ...data.user, team: data.team });
  return data;
}

export async function verifyToken() {
  return apiFetch('/auth/api/token/verify', { method: 'POST' });
}

export function logout() {
  clearAuth();
  window.location.href = '/login';
}
