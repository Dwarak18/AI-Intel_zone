import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api/client';

interface TeamMember { name: string; email: string; }
interface Team {
  id: number; teamCode: string; name: string; institution: string;
  password: string; status: string; totalScore: number;
  TeamMembers: TeamMember[];
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalTeam, setModalTeam] = useState<Team | null>(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [newTeamPass, setNewTeamPass] = useState('');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.teams({ status: statusFilter, search });
      setTeams(r.data.teams || []);
    } finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleLock = async (t: Team) => {
    if (!confirm(`Lock team ${t.teamCode}?`)) return;
    await adminApi.lockTeam(t.id);
    showToast(`${t.teamCode} locked`);
    load();
  };
  const handleDisqualify = async (t: Team) => {
    if (!confirm(`Disqualify team ${t.teamCode}? This cannot be undone.`)) return;
    await adminApi.disqualifyTeam(t.id);
    showToast(`${t.teamCode} disqualified`);
    load();
  };
  const handleOverride = async () => {
    if (!modalTeam) return;
    await adminApi.overrideScore(modalTeam.id, +overrideScore, overrideReason);
    showToast('Score overridden');
    setModalTeam(null);
    load();
  };
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await adminApi.createTeam(newTeamCode.toUpperCase(), newTeamPass);
      showToast(`Team ${newTeamCode} created`);
      setNewTeamCode(''); setNewTeamPass('');
      load();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Create failed');
    } finally { setCreating(false); }
  };

  const statusColor: Record<string, string> = { active: 'valid', locked: 'warn', disqualified: 'error', pending: 'info' };

  return (
    <AdminLayout>
      {toast && <div className="arena-toast">{toast}</div>}
      <div className="page-header">
        <h1 className="page-title"><i className="bi bi-people-fill me-2 text-accent" />Teams</h1>
      </div>

      <div className="arena-panel mb-4">
        <div className="arena-panel-header"><span><i className="bi bi-person-plus me-2" />Create Team</span></div>
        <form onSubmit={handleCreate} className="d-flex gap-2 flex-wrap p-1">
          <input value={newTeamCode} onChange={e => setNewTeamCode(e.target.value.toUpperCase())}
            className="form-control mono" placeholder="Team code e.g. TECH-123456" style={{ maxWidth: 240 }} required />
          <input value={newTeamPass} onChange={e => setNewTeamPass(e.target.value)}
            className="form-control" placeholder="Password" style={{ maxWidth: 200 }} required />
          <button type="submit" className="btn btn-arena-sm" disabled={creating}>
            {creating ? 'Creating…' : <><i className="bi bi-plus-circle me-1" />Create</>}
          </button>
        </form>
      </div>

      <div className="arena-panel">
        <div className="arena-panel-header d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span><i className="bi bi-table me-2" />{teams.length} teams</span>
          <div className="d-flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="form-control form-control-sm" placeholder="Search…" style={{ width: 160 }} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select form-select-sm" style={{ width: 130 }}>
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="disqualified">Disqualified</option>
            </select>
          </div>
        </div>
        {loading ? <div className="arena-loader">Loading…</div> : (
          <div className="table-responsive">
            <table className="arena-table">
              <thead><tr><th>Code</th><th>Name / Institution</th><th>Password</th><th>Status</th><th>Score</th><th>Members</th><th>Actions</th></tr></thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.id}>
                    <td className="mono">{t.teamCode}</td>
                    <td><div>{t.name || '—'}</div><div className="text-muted small">{t.institution || ''}</div></td>
                    <td className="mono" style={{ fontSize: '.78rem' }}>{t.password}</td>
                    <td><span className={`badge-status ${statusColor[t.status] || 'info'}`}>{t.status}</span></td>
                    <td className="text-accent mono">{t.totalScore ?? 0}</td>
                    <td className="text-muted small">
                      {t.TeamMembers?.length > 0 ? t.TeamMembers.map(m => m.name).join(', ') : '—'}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button className="btn btn-arena-sm" onClick={() => { setModalTeam(t); setOverrideScore(String(t.totalScore ?? 0)); setOverrideReason(''); }}>
                          <i className="bi bi-pencil" />
                        </button>
                        {t.status === 'active' && <button className="btn btn-arena-sm warn" onClick={() => handleLock(t)}><i className="bi bi-lock" /></button>}
                        {t.status !== 'disqualified' && <button className="btn btn-arena-sm danger" onClick={() => handleDisqualify(t)}><i className="bi bi-slash-circle" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {teams.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">No teams found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalTeam && (
        <div className="arena-modal-overlay" onClick={() => setModalTeam(null)}>
          <div className="arena-modal" onClick={e => e.stopPropagation()}>
            <div className="arena-modal-header">
              <span>Override Score — <span className="mono">{modalTeam.teamCode}</span></span>
              <button className="btn-close-modal" onClick={() => setModalTeam(null)}>✕</button>
            </div>
            <div className="arena-modal-body">
              <div className="mb-3">
                <label className="form-label">New Score</label>
                <input type="number" value={overrideScore} onChange={e => setOverrideScore(e.target.value)} className="form-control mono" />
              </div>
              <div className="mb-4">
                <label className="form-label">Reason</label>
                <input value={overrideReason} onChange={e => setOverrideReason(e.target.value)} className="form-control" placeholder="Reason for override" />
              </div>
              <button className="btn btn-arena w-100" onClick={handleOverride}><i className="bi bi-check-lg me-2" />Apply Override</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
