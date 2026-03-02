import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { getAdminMissions, toggleMission } from '../../api/admin.js';

const DIFFICULTY_COLORS = { easy: 'success', medium: 'warning', hard: 'danger', extreme: 'danger' };

export default function AdminMissions() {
  const [missions, setMissions] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await getAdminMissions();
      setMissions(data.missions || []);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(id) {
    try { await toggleMission(id); load(); } catch (err) { setError(err.message); }
  }

  return (
    <AdminLayout>
      <div className="mb-4">
        <h3 className="mb-0 fw-bold">Missions</h3>
        <small className="text-muted">{missions.length} missions configured</small>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3">
        {missions.map(m => (
          <div className="col-md-6" key={m.id}>
            <div className="card h-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <div>
                  <span className="badge bg-secondary font-monospace me-2">{m.missionCode}</span>
                  <span className={`badge bg-${DIFFICULTY_COLORS[m.difficulty] || 'secondary'}`}>{m.difficulty}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge ${m.isVisible ? 'bg-success' : 'bg-secondary'}`}>
                    {m.isVisible ? 'Visible' : 'Hidden'}
                  </span>
                  <button className={`btn btn-sm ${m.isVisible ? 'btn-outline-warning' : 'btn-outline-success'}`}
                    onClick={() => handleToggle(m.id)}>
                    {m.isVisible ? <><i className="bi bi-eye-slash" /> Hide</> : <><i className="bi bi-eye" /> Show</>}
                  </button>
                </div>
              </div>
              <div className="card-body">
                <h6 className="fw-bold mb-1">{m.title}</h6>
                <p className="text-muted small mb-2" style={{ fontSize: '.8rem' }}>
                  {m.description?.substring(0, 160)}{m.description?.length > 160 ? '…' : ''}
                </p>
                <div className="d-flex gap-3 small text-muted">
                  <span><i className="bi bi-award me-1" />{m.maxPoints} pts</span>
                  <span><i className="bi bi-clock me-1" />{Math.round(m.timeLimitSeconds / 60)}m</span>
                  <span><i className="bi bi-arrow-repeat me-1" />{m.maxRetries} retries</span>
                  <span><i className="bi bi-tag me-1" />{m.category}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
