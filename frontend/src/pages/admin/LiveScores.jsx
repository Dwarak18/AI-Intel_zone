import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import AdminLayout from '../../components/AdminLayout.jsx';
import { getLiveScores } from '../../api/admin.js';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export default function AdminLiveScores() {
  const [teams, setTeams] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef(null);

  async function loadInitial() {
    try {
      const d = await getLiveScores();
      setTeams(d.teams || []);
      setUpdatedAt(d.updatedAt);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => {
    loadInitial();

    const token = localStorage.getItem('arena_token');
    const socket = io(`${BASE_URL}/admin`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('live_scores_update', ({ teams: t, updatedAt: ua }) => {
      setTeams(t || []);
      setUpdatedAt(ua);
    });

    return () => socket.disconnect();
  }, []);

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <AdminLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h3 className="mb-0 fw-bold">Live Scores</h3>
          {updatedAt && <small className="text-muted">Updated: {new Date(updatedAt).toLocaleTimeString()}</small>}
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className={`badge ${connected ? 'bg-success' : 'bg-secondary'}`}>
            <span className={connected ? 'live-dot me-1' : ''} />
            {connected ? 'LIVE' : 'Connecting…'}
          </span>
          <button className="btn btn-sm btn-outline-secondary" onClick={loadInitial}>
            <i className="bi bi-arrow-clockwise" />
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr className="text-muted small">
                <th>Rank</th><th>Team</th><th>Combined Score</th>
                <th>Base</th><th>Bonus</th><th>Missions</th>
                <th>Submissions</th><th>Val. Rate</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 && <tr><td colSpan={9} className="text-center text-muted py-4">No teams ranked yet</td></tr>}
              {teams.map((t, i) => (
                <tr key={t.id} className={t.status === 'disqualified' ? 'opacity-50' : ''}>
                  <td className="fw-bold fs-5">{MEDAL[i] || t.rank || i + 1}</td>
                  <td>
                    <span className="fw-semibold">{t.name}</span><br />
                    <span className="badge bg-secondary font-monospace" style={{ fontSize: '.7rem' }}>{t.teamCode}</span>
                    {t.institution && <small className="text-muted d-block">{t.institution}</small>}
                  </td>
                  <td><span className="fw-bold text-warning fs-6">{t.combinedScore?.toFixed(1)}</span></td>
                  <td className="text-success">{t.totalScore?.toFixed(1)}</td>
                  <td className="text-info">+{t.bonusPoints?.toFixed(1)}</td>
                  <td>{t.missionsCompleted}</td>
                  <td>{t.totalSubmissions}</td>
                  <td>
                    <div className="progress" style={{ height: 6, width: 60 }}>
                      <div className="progress-bar bg-success" style={{ width: `${t.validationRate}%` }} />
                    </div>
                    <small className="text-muted">{t.validationRate?.toFixed(1)}%</small>
                  </td>
                  <td>
                    <span className={`badge badge-${t.status}`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
