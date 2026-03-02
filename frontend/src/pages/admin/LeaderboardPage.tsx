import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api/client';

interface LBEntry { rank: number; teamCode: string; name: string; totalScore: number; submissionCount: number; successCount: number; lastActivity: string; }

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    try { const r = await adminApi.leaderboard(); setEntries(r.data.leaderboard || []); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const recalculate = async () => {
    setRecalculating(true);
    try { await adminApi.recalculate(); showToast('Leaderboard recalculated'); load(); }
    catch { showToast('Recalculation failed'); }
    finally { setRecalculating(false); }
  };

  const maxScore = entries[0]?.totalScore || 1;
  const medalColor = ['#fbbf24', '#94a3b8', '#cd7f32'];

  return (
    <AdminLayout>
      {toast && <div className="arena-toast">{toast}</div>}
      <div className="page-header">
        <h1 className="page-title"><i className="bi bi-trophy-fill me-2 text-accent" />Leaderboard</h1>
        <button className="btn btn-arena-sm" onClick={recalculate} disabled={recalculating}>
          <i className="bi bi-arrow-clockwise me-1" />{recalculating ? 'Recalculating…' : 'Recalculate'}
        </button>
      </div>
      <div className="arena-panel">
        {loading ? <div className="arena-loader">Loading…</div> : (
          <div className="table-responsive">
            <table className="arena-table">
              <thead><tr><th style={{ width: 50 }}>#</th><th>Team</th><th>Score</th><th>Progress</th><th>Submissions</th><th>Success Rate</th><th>Last Active</th></tr></thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.teamCode} style={i === 0 ? { background: 'rgba(99,102,241,.08)' } : {}}>
                    <td style={{ color: medalColor[i] || 'var(--muted)', fontSize: i < 3 ? '1.1rem' : undefined }}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : e.rank}
                    </td>
                    <td><div className="mono">{e.teamCode}</div><div className="text-muted small">{e.name || ''}</div></td>
                    <td className="text-accent mono" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{e.totalScore}</td>
                    <td style={{ minWidth: 120 }}>
                      <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${(e.totalScore / maxScore) * 100}%`, background: 'var(--accent)', height: '100%', borderRadius: 4 }} />
                      </div>
                    </td>
                    <td className="mono">{e.submissionCount}</td>
                    <td className="text-muted">
                      {e.submissionCount > 0 ? `${Math.round((e.successCount / e.submissionCount) * 100)}%` : '—'}
                    </td>
                    <td className="text-muted small">{e.lastActivity ? new Date(e.lastActivity).toLocaleTimeString() : '—'}</td>
                  </tr>
                ))}
                {entries.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">No data yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
