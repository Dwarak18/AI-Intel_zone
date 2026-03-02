import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api/client';

interface Mission {
  id: number; missionCode: string; title: string; difficulty: string;
  maxPoints: number; maxRetries: number; isVisible: boolean; description: string;
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    try { const r = await adminApi.missions(); setMissions(r.data.missions || []); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const toggle = async (m: Mission) => {
    await adminApi.toggleMission(m.id);
    showToast(`${m.missionCode} ${m.isVisible ? 'hidden' : 'visible'}`);
    load();
  };

  const diffColor: Record<string, string> = {
    easy: '#10b981', medium: '#f59e0b', hard: '#ef4444', expert: '#8b5cf6'
  };

  return (
    <AdminLayout>
      {toast && <div className="arena-toast">{toast}</div>}
      <div className="page-header">
        <h1 className="page-title"><i className="bi bi-journal-code me-2 text-accent" />Missions</h1>
      </div>
      <div className="arena-panel">
        <div className="arena-panel-header d-flex justify-content-between">
          <span><i className="bi bi-list-task me-2" />{missions.length} missions</span>
        </div>
        {loading ? <div className="arena-loader">Loading…</div> : (
          <div className="table-responsive">
            <table className="arena-table">
              <thead><tr><th>Code</th><th>Title</th><th>Difficulty</th><th>Max Points</th><th>Retries</th><th>Visible</th><th>Toggle</th></tr></thead>
              <tbody>
                {missions.map(m => (
                  <tr key={m.id}>
                    <td className="mono">{m.missionCode}</td>
                    <td>
                      <div>{m.title}</div>
                      {m.description && <div className="text-muted small" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</div>}
                    </td>
                    <td><span style={{ color: diffColor[m.difficulty] || '#94a3b8', fontWeight: 600, fontSize: '.78rem', textTransform: 'uppercase' }}>{m.difficulty}</span></td>
                    <td className="mono text-accent">{m.maxPoints}</td>
                    <td className="mono">{m.maxRetries}</td>
                    <td>
                      <span className={`badge-status ${m.isVisible ? 'valid' : 'error'}`}>{m.isVisible ? 'Visible' : 'Hidden'}</span>
                    </td>
                    <td>
                      <button className={`btn btn-arena-sm ${m.isVisible ? 'warn' : ''}`} onClick={() => toggle(m)}>
                        <i className={`bi ${m.isVisible ? 'bi-eye-slash' : 'bi-eye'} me-1`} />
                        {m.isVisible ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  </tr>
                ))}
                {missions.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">No missions</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
