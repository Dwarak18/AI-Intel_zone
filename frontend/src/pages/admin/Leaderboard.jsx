import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { getAdminLeaderboard, recalculateLeaderboard } from '../../api/admin.js';

const MEDAL = ['🥇','🥈','🥉'];

export default function AdminLeaderboard() {
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [recalcing, setRecalcing] = useState(false);

  async function load() {
    try { const d = await getAdminLeaderboard(); setTeams(d.teams || []); }
    catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, []);

  async function handleRecalc() {
    setRecalcing(true);
    try { await recalculateLeaderboard(); await load(); }
    catch (err) { setError(err.message); } finally { setRecalcing(false); }
  }

  return (
    <AdminLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h3 className="mb-0 fw-bold">Leaderboard</h3>
          <small className="text-muted">{teams.length} ranked teams</small>
        </div>
        <button className="btn btn-outline-primary" onClick={handleRecalc} disabled={recalcing}>
          {recalcing ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-arrow-repeat me-1" />}
          Recalculate
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr className="text-muted small">
                <th>Rank</th><th>Team</th><th>Institution</th>
                <th>Score</th><th>Bonus</th><th>Missions</th><th>Submissions</th><th>Health</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 && <tr><td colSpan={8} className="text-center text-muted py-4">No teams ranked yet</td></tr>}
              {teams.map((t, i) => (
                <tr key={t.id} className={i < 3 ? 'table-active' : ''}>
                  <td className="fw-bold fs-5">{MEDAL[i] || t.rank || i + 1}</td>
                  <td>
                    <span className="fw-semibold">{t.name}</span><br />
                    <span className="badge bg-secondary font-monospace" style={{ fontSize: '.7rem' }}>{t.teamCode}</span>
                  </td>
                  <td className="text-muted small">{t.institution}</td>
                  <td><span className="fw-bold text-success fs-6">{t.totalScore?.toFixed(1)}</span></td>
                  <td className="text-info">+{t.bonusPoints?.toFixed(1)}</td>
                  <td>{t.missionsCompleted}</td>
                  <td>{t.totalSubmissions}</td>
                  <td>
                    <div className="progress" style={{ height: 6, width: 60 }}>
                      <div className="progress-bar bg-info" style={{ width: `${t.healthScore}%` }} />
                    </div>
                    <small className="text-muted">{t.healthScore?.toFixed(0)}%</small>
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
