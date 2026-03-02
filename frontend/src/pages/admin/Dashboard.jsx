import React, { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { getStats, getAnalytics, getActivityFeed } from '../../api/admin.js';

function StatCard({ icon, label, value, color = 'primary', sub }) {
  return (
    <div className="card h-100">
      <div className="card-body d-flex align-items-center gap-3">
        <div className={`text-${color} fs-2`}><i className={`bi ${icon}`} /></div>
        <div>
          <div className="fs-3 fw-bold">{value ?? '—'}</div>
          <div className="text-muted small">{label}</div>
          {sub && <div className="text-muted" style={{ fontSize: '.75rem' }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([getStats(), getActivityFeed(15)]);
      setStats(s);
      setFeed(f.feed || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <AdminLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h3 className="mb-0 fw-bold">Dashboard</h3>
          <small className="text-muted">Real-time competition overview</small>
        </div>
        <span className="badge bg-success">
          <span className="live-dot me-1" />LIVE
        </span>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Team stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-3"><StatCard icon="bi-people-fill" label="Total Teams" value={stats?.teams.total} color="primary" /></div>
        <div className="col-md-3"><StatCard icon="bi-check-circle-fill" label="Active Teams" value={stats?.teams.active} color="success" /></div>
        <div className="col-md-3"><StatCard icon="bi-lock-fill" label="Locked Teams" value={stats?.teams.locked} color="warning" /></div>
        <div className="col-md-3"><StatCard icon="bi-x-circle-fill" label="Disqualified" value={stats?.teams.disqualified} color="danger" /></div>
      </div>

      {/* Submission stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-3"><StatCard icon="bi-send-fill" label="Total Submissions" value={stats?.submissions.total} color="info" /></div>
        <div className="col-md-3"><StatCard icon="bi-patch-check-fill" label="Valid" value={stats?.submissions.valid} color="success" /></div>
        <div className="col-md-3"><StatCard icon="bi-x-octagon-fill" label="Invalid" value={stats?.submissions.invalid} color="danger" /></div>
        <div className="col-md-3"><StatCard icon="bi-exclamation-triangle-fill" label="Last Hour" value={stats?.submissions.recentHour} color="warning" sub="submissions" /></div>
      </div>

      {/* Security */}
      <div className="row g-3 mb-4">
        <div className="col-md-4"><StatCard icon="bi-shield-exclamation" label="Open Security Events" value={stats?.security.openEvents} color="danger" /></div>
        <div className="col-md-4"><StatCard icon="bi-flag-fill" label="Flagged Submissions" value={stats?.security.flagged} color="warning" /></div>
        <div className="col-md-4"><StatCard icon="bi-person-video3" label="Active Users (5m)" value={stats?.activeUsers5m} color="primary" /></div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <span className="fw-semibold"><i className="bi bi-activity me-2 text-primary" />Recent Submissions</span>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}>
            <i className="bi bi-arrow-clockwise" />
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr className="text-muted small">
                <th>Team</th><th>Mission</th><th>Status</th><th>Score</th><th>Time</th>
              </tr>
            </thead>
            <tbody>
              {feed.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted py-4">No recent submissions</td></tr>
              )}
              {feed.map(sub => (
                <tr key={sub.id} className={sub.suspicious ? 'table-danger' : ''}>
                  <td><span className="fw-semibold">{sub.teamCode}</span><br /><small className="text-muted">{sub.teamName}</small></td>
                  <td className="small">{sub.mission}</td>
                  <td>
                    <span className={`badge badge-${sub.status}`}>{sub.status}</span>
                    {sub.flagged && <span className="badge bg-warning ms-1">flagged</span>}
                  </td>
                  <td>{sub.score}</td>
                  <td className="text-muted small">{new Date(sub.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
