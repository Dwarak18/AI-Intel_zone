import { apiFetch } from './client.js';

export const getMissions = () => apiFetch('/api/missions');
export const getMission = (id) => apiFetch(`/api/missions/${id}`);
export const getMissionHistory = (id) => apiFetch(`/api/missions/${id}/history`);
export const getTeamInfo = (teamId) => apiFetch(`/api/team/${teamId}`);
export const getTeamSubmissions = (teamId) => apiFetch(`/api/team/${teamId}/submissions`);
export const getLeaderboard = () => apiFetch('/api/leaderboard');

export const submitAnswer = (body) => apiFetch('/api/submit', {
  method: 'POST',
  body: JSON.stringify(body),
});

export const sandboxAnswer = (body) => apiFetch('/api/sandbox', {
  method: 'POST',
  body: JSON.stringify(body),
});
