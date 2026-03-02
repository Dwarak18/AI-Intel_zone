import { apiFetch } from './client.js';

// Dashboard
export const getStats = () => apiFetch('/admin/api/stats');
export const getAnalytics = () => apiFetch('/admin/api/analytics');
export const getActivityFeed = (limit = 20) => apiFetch(`/admin/api/activity_feed?limit=${limit}`);

// Teams
export const getTeams = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/admin/api/teams${q ? '?' + q : ''}`);
};
export const createTeam = (body) => apiFetch('/admin/api/teams/create', {
  method: 'POST', body: JSON.stringify(body),
});
export const addTeamMember = (teamId, body) => apiFetch(`/admin/api/teams/${teamId}/add_member`, {
  method: 'POST', body: JSON.stringify(body),
});
export const lockTeam = (teamId) => apiFetch(`/admin/api/teams/${teamId}/lock`, { method: 'POST' });
export const disqualifyTeam = (teamId, reason) => apiFetch(`/admin/api/teams/${teamId}/disqualify`, {
  method: 'POST', body: JSON.stringify({ reason }),
});
export const overrideScore = (teamId, body) => apiFetch(`/admin/api/teams/${teamId}/override`, {
  method: 'POST', body: JSON.stringify(body),
});

// Missions
export const getAdminMissions = () => apiFetch('/admin/api/missions');
export const toggleMission = (missionId) => apiFetch(`/admin/api/missions/${missionId}/toggle`, { method: 'POST' });

// Leaderboard
export const getAdminLeaderboard = () => apiFetch('/admin/api/leaderboard');
export const recalculateLeaderboard = () => apiFetch('/admin/api/leaderboard/recalculate', { method: 'POST' });

// Live scores
export const getLiveScores = () => apiFetch('/admin/api/live-scores');

// Logs
export const getLogs = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/admin/api/logs${q ? '?' + q : ''}`);
};
export const getLogDetail = (logId) => apiFetch(`/admin/api/logs/${logId}`);

// Security
export const getSecurityEvents = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/admin/api/security${q ? '?' + q : ''}`);
};
export const resolveSecurityEvent = (eventId, body) => apiFetch(`/admin/api/security/${eventId}/resolve`, {
  method: 'POST', body: JSON.stringify(body),
});

// Audit
export const getAuditLogs = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/admin/api/audit${q ? '?' + q : ''}`);
};
