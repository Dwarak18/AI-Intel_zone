import React, { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { getActivityFeed, getStats } from '../../api/admin.js';

export default function AdminActivity() {
  const [feed, setFeed] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [f, s] = await Promise.all([getActivityFeed(50), getStats()]);
      setFeed(f.feed || []);
      setStats(s);
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <AdminLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h3 className="mb-0 fw-bold">Activity Monitor</h3>
          <small className="text-muted">Auto-refreshes every 10 seconds</small>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <span className="badge bg-success"><span className="live-dot me-1" />LIVE</span>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise" /></button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Quick stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card text-center py-2">
            <div className="fs-3 fw-bold text-info">{stats?.activeUsers5m ?? '—'}</div>
            <div className="text-muted small">Active Users (5m)</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center py-2">
            <div className="fs-3 fw-bold text-warning">{stats?.submissions.recentHour ?? '—'}</div>
            <div className="text-muted small">Submissions (1h)</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center py-2">
            <div className="fs-3 fw-bold text-danger">{stats?.security.flagged ?? '—'}</div>
            <div className="text-muted small">Flagged</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center py-2">
            <div className="fs-3 fw-bold text-danger">{stats?.security.openEvents ?? '—'}</div>
            <div className="text-muted small">Open Security Events</div>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="card">
        <div className="card-header fw-semibold"><i className="bi bi-activity me-2 text-success" />Live Submission Feed</div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 small">
            <thead>
              <tr className="text-muted">
                <th>Time</th><th>Team</th><th>Mission</th>
                <th>Status</th><th>Score</th><th>Attempt</th><th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {feed.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">No recent activity</td></tr>}
              {feed.map(sub => (
                <tr key={sub.id} className={sub.suspicious ? 'table-warning' : ''}>
                  <td className="text-muted">{new Date(sub.createdAt).toLocaleTimeString()}</td>
                  <td><span className="fw-semibold">{sub.teamCode}</span></td>
                  <td>{sub.mission}</td>
                  <td><span className={`badge badge-${sub.status}`}>{sub.status}</span></td>
                  <td className="text-success fw-semibold">{sub.score}</td>
                  <td>#{sub.attempt}</td>
                  <td>
                    {sub.flagged && <span className="badge bg-warning me-1">flagged</span>}
                    {sub.suspicious && <span className="badge bg-danger">⚠ suspicious</span>}
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
