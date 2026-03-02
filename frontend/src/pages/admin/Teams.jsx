import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { getTeams, createTeam, lockTeam, disqualifyTeam, overrideScore } from '../../api/admin.js';

function StatusBadge({ status }) {
  const cl = { active: 'badge-active', locked: 'badge-locked', disqualified: 'badge-disqualified' }[status] || 'bg-secondary';
  return <span className={`badge ${cl}`}>{status}</span>;
}

export default function AdminTeams() {
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTeam, setNewTeam] = useState({ team_code: '', name: '', institution: '', login_password: '' });
  const [overrideModal, setOverrideModal] = useState(null); // { team }
  const [overrideForm, setOverrideForm] = useState({ new_score: '', reason: '' });

  async function load() {
    try {
      const p = {};
      if (statusFilter !== 'all') p.status = statusFilter;
      if (search) p.search = search;
      const data = await getTeams(p);
      setTeams(data.teams || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [statusFilter, search]);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await createTeam(newTeam);
      setShowCreate(false);
      setNewTeam({ team_code: '', name: '', institution: '', login_password: '' });
      load();
    } catch (err) { setError(err.message); }
  }

  async function handleLock(teamId) {
    try { await lockTeam(teamId); load(); } catch (err) { setError(err.message); }
  }

  async function handleDisqualify(team) {
    const reason = window.prompt(`Disqualify ${team.name}?\n\nReason:`, 'Violation of rules');
    if (reason == null) return;
    try { await disqualifyTeam(team.id, reason); load(); } catch (err) { setError(err.message); }
  }

  async function handleOverride(e) {
    e.preventDefault();
    try {
      await overrideScore(overrideModal.id, overrideForm);
      setOverrideModal(null);
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <AdminLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h3 className="mb-0 fw-bold">Team Management</h3>
          <small className="text-muted">{teams.length} teams</small>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          <i className="bi bi-plus-lg me-1" />New Team
        </button>
      </div>

      {error && <div className="alert alert-danger alert-dismissible"><button className="btn-close" onClick={() => setError('')} />{error}</div>}

      {/* Create team form */}
      {showCreate && (
        <div className="card mb-4">
          <div className="card-header fw-semibold">Create New Team</div>
          <div className="card-body">
            <form onSubmit={handleCreate} className="row g-3">
              <div className="col-md-3">
                <input className="form-control bg-dark border-secondary text-white" placeholder="Team Code *" value={newTeam.team_code}
                  onChange={e => setNewTeam({ ...newTeam, team_code: e.target.value.toUpperCase() })} required />
              </div>
              <div className="col-md-3">
                <input className="form-control bg-dark border-secondary text-white" placeholder="Team Name *" value={newTeam.name}
                  onChange={e => setNewTeam({ ...newTeam, name: e.target.value })} required />
              </div>
              <div className="col-md-3">
                <input className="form-control bg-dark border-secondary text-white" placeholder="Institution" value={newTeam.institution}
                  onChange={e => setNewTeam({ ...newTeam, institution: e.target.value })} />
              </div>
              <div className="col-md-2">
                <input className="form-control bg-dark border-secondary text-white" placeholder="Login Password" value={newTeam.login_password}
                  onChange={e => setNewTeam({ ...newTeam, login_password: e.target.value })} />
              </div>
              <div className="col-md-1">
                <button className="btn btn-success w-100" type="submit">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="d-flex gap-2 mb-3">
        <input className="form-control bg-dark border-secondary text-white" style={{ maxWidth: 240 }}
          placeholder="Search teams…" value={search} onChange={e => setSearch(e.target.value)} />
        {['all', 'active', 'locked', 'disqualified'].map(s => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
      </div>

      {/* Teams table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr className="text-muted small">
                <th>#</th><th>Code</th><th>Name</th><th>Institution</th>
                <th>Score</th><th>Missions</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted py-4">No teams found</td></tr>
              )}
              {teams.map(t => (
                <tr key={t.id}>
                  <td className="text-muted">{t.currentRank || '—'}</td>
                  <td><span className="badge bg-secondary font-monospace">{t.teamCode}</span></td>
                  <td>
                    <span className="fw-semibold">{t.name}</span>
                    {t.loginPassword && <small className="text-muted d-block">pw: {t.loginPassword}</small>}
                  </td>
                  <td className="text-muted small">{t.institution}</td>
                  <td><span className="fw-bold text-success">{t.totalScore.toFixed(1)}</span></td>
                  <td>{t.missionsCompleted}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>
                    <div className="d-flex gap-1">
                      <button className={`btn btn-xs btn-sm ${t.status === 'locked' ? 'btn-success' : 'btn-warning'}`}
                        style={{ fontSize: '.75rem', padding: '2px 8px' }}
                        onClick={() => handleLock(t.id)}>
                        {t.status === 'locked' ? 'Unlock' : 'Lock'}
                      </button>
                      <button className="btn btn-sm btn-outline-danger"
                        style={{ fontSize: '.75rem', padding: '2px 8px' }}
                        onClick={() => handleDisqualify(t)}>DQ</button>
                      <button className="btn btn-sm btn-outline-info"
                        style={{ fontSize: '.75rem', padding: '2px 8px' }}
                        onClick={() => { setOverrideModal(t); setOverrideForm({ new_score: t.totalScore, reason: '' }); }}>
                        Score
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Score override modal */}
      {overrideModal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,.7)' }}>
          <div className="modal-dialog">
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">Score Override — {overrideModal.name}</h5>
                <button className="btn-close btn-close-white" onClick={() => setOverrideModal(null)} />
              </div>
              <form onSubmit={handleOverride}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">New Score</label>
                    <input type="number" step="0.01" className="form-control bg-dark border-secondary text-white"
                      value={overrideForm.new_score}
                      onChange={e => setOverrideForm({ ...overrideForm, new_score: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Reason *</label>
                    <textarea className="form-control bg-dark border-secondary text-white" rows={3}
                      value={overrideForm.reason}
                      onChange={e => setOverrideForm({ ...overrideForm, reason: e.target.value })} required />
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button type="button" className="btn btn-secondary" onClick={() => setOverrideModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-warning">Apply Override</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
