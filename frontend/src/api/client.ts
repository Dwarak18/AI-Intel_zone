import axios from 'axios';

const api = axios.create({ baseURL: '/' });

const TOKEN_KEY = 'arena_token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

// Attach JWT to every request if present
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-redirect on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
      const path = window.location.pathname;
      // Use '/admin/' and '/team/' (with trailing slash) to avoid matching
      // login pages like /team-login which also start with '/team'
      if (path.startsWith('/admin/')) window.location.href = '/login';
      else if (path.startsWith('/team/')) window.location.href = '/team-login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────
export const authApi = {
  loginAdmin: (username: string, password: string) =>
    api.post('/auth/api/token', { username, password }),
  loginTeam: (team_code: string, password: string) =>
    api.post('/auth/api/team-token', { team_code, password }),
  me: () => api.get('/auth/api/me'),
  logout: () => { clearToken(); return api.get('/auth/logout').catch(() => {}); },
};

// ── Admin API ─────────────────────────────────────────────
export const adminApi = {
  stats: () => api.get('/admin/api/stats'),
  analytics: () => api.get('/admin/api/analytics'),
  activityFeed: (limit = 20) => api.get(`/admin/api/activity_feed?limit=${limit}`),
  liveScores: () => api.get('/admin/api/live-scores'),
  teams: (params?: Record<string, string>) => api.get('/admin/api/teams', { params }),
  createTeam: (teamCode: string, password: string) => api.post('/admin/api/teams/create', { teamCode, password }),
  lockTeam: (id: string | number) => api.post(`/admin/api/teams/${id}/lock`),
  disqualifyTeam: (id: string | number, reason?: string) => api.post(`/admin/api/teams/${id}/disqualify`, { reason: reason || 'Admin action' }),
  overrideScore: (id: string | number, new_score: number, reason: string) =>
    api.post(`/admin/api/teams/${id}/override`, { new_score, reason, override_type: 'correction' }),
  missions: () => api.get('/admin/api/missions'),
  toggleMission: (id: string | number) => api.post(`/admin/api/missions/${id}/toggle`),
  logs: (params?: Record<string, any>) => api.get('/admin/api/logs', { params }),
  logDetail: (id: string | number) => api.get(`/admin/api/logs/${id}`),
  security: (params?: Record<string, any>) => api.get('/admin/api/security', { params }),
  resolveEvent: (id: string | number, status = 'resolved', notes = '') =>
    api.post(`/admin/api/security/${id}/resolve`, { status, notes }),
  audit: (params?: Record<string, any>) => api.get('/admin/api/audit', { params }),
  leaderboard: () => api.get('/admin/api/leaderboard'),
  recalculate: () => api.post('/admin/api/leaderboard/recalculate'),
  // Timer
  timerState: () => api.get('/admin/api/timer'),
  timerStart: (totalSeconds: number) => api.post('/admin/api/timer/start', { totalSeconds }),
  timerPause: () => api.post('/admin/api/timer/pause'),
  timerResume: () => api.post('/admin/api/timer/resume'),
  timerReset: () => api.post('/admin/api/timer/reset'),
  timerAdjust: (delta: number) => api.post('/admin/api/timer/adjust', { delta }),
  timerSetDuration: (totalSeconds: number) => api.post('/admin/api/timer/duration', { totalSeconds }),
};

// ── Team API ──────────────────────────────────────────────
export const teamApi = {
  missions: () => api.get('/api/missions'),
  missionHistory: (missionId: string | number) => api.get(`/api/missions/${missionId}/history`),
  submit: (data: object) => api.post('/api/submit', data),
  sandbox: (data: object) => api.post('/api/sandbox', data),
  leaderboard: () => api.get('/api/leaderboard'),
};
