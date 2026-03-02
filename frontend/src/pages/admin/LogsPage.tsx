import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api/client';

interface Log {
  id: number; teamCode: string; missionCode: string; status: string;
  confidenceScore: number; hallucinationScore: number; injectionScore: number;
  flagged: boolean; createdAt: string; promptText: string;
}
interface LogDetail extends Log { responseText: string; validationNotes: string; }

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [flaggedFilter, setFlaggedFilter] = useState('');
  const [detail, setDetail] = useState<LogDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.logs({ status: statusFilter, flagged: flaggedFilter, page });
      setLogs(r.data.logs || []);
      setTotalPages(r.data.totalPages || 1);
    } finally { setLoading(false); }
  }, [statusFilter, flaggedFilter, page]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: number) => {
    const r = await adminApi.logDetail(id);
    setDetail(r.data);
  };

  const scoreColor = (v: number) => v > 0.7 ? '#ef4444' : v > 0.4 ? '#f59e0b' : '#10b981';

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title"><i className="bi bi-file-text me-2 text-accent" />AI Logs</h1>
      </div>
      <div className="arena-panel">
        <div className="arena-panel-header d-flex justify-content-between flex-wrap gap-2">
          <span><i className="bi bi-journals me-2" />Submission logs</span>
          <div className="d-flex gap-2">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="form-select form-select-sm" style={{ width: 130 }}>
              <option value="">All status</option>
              <option value="valid">Valid</option>
              <option value="invalid">Invalid</option>
              <option value="error">Error</option>
            </select>
            <select value={flaggedFilter} onChange={e => { setFlaggedFilter(e.target.value); setPage(1); }} className="form-select form-select-sm" style={{ width: 130 }}>
              <option value="">All logs</option>
              <option value="1">Flagged only</option>
            </select>
          </div>
        </div>
        {loading ? <div className="arena-loader">Loading…</div> : (
          <>
            <div className="table-responsive">
              <table className="arena-table">
                <thead><tr><th>Team</th><th>Mission</th><th>Status</th><th>Confidence</th><th>Hallucination</th><th>Injection</th><th>Flagged</th><th>Time</th><th></th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td className="mono">{l.teamCode}</td>
                      <td className="mono">{l.missionCode}</td>
                      <td><span className={`badge-status ${l.status}`}>{l.status}</span></td>
                      <td><span style={{ color: scoreColor(l.confidenceScore), fontFamily: 'monospace' }}>{(l.confidenceScore * 100).toFixed(0)}%</span></td>
                      <td><span style={{ color: scoreColor(l.hallucinationScore), fontFamily: 'monospace' }}>{(l.hallucinationScore * 100).toFixed(0)}%</span></td>
                      <td><span style={{ color: scoreColor(l.injectionScore), fontFamily: 'monospace' }}>{(l.injectionScore * 100).toFixed(0)}%</span></td>
                      <td>{l.flagged ? <span className="badge-status error"><i className="bi bi-flag-fill" /></span> : <span className="text-muted">—</span>}</td>
                      <td className="text-muted" style={{ fontSize: '.78rem' }}>{new Date(l.createdAt).toLocaleTimeString()}</td>
                      <td><button className="btn btn-arena-sm" onClick={() => openDetail(l.id)}><i className="bi bi-eye" /></button></td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={9} className="text-center py-4 text-muted">No logs</td></tr>}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="arena-pagination">
                <button className="btn btn-arena-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                <span className="text-muted">Page {page} / {totalPages}</span>
                <button className="btn btn-arena-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
              </div>
            )}
          </>
        )}
      </div>

      {detail && (
        <div className="arena-modal-overlay" onClick={() => setDetail(null)}>
          <div className="arena-modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="arena-modal-header">
              <span>Log #{detail.id} — <span className="mono">{detail.teamCode}</span> / <span className="mono">{detail.missionCode}</span></span>
              <button className="btn-close-modal" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="arena-modal-body">
              <div className="mb-3">
                <label className="form-label">Prompt</label>
                <pre className="code-box">{detail.promptText || '—'}</pre>
              </div>
              <div className="mb-3">
                <label className="form-label">Response</label>
                <pre className="code-box">{detail.responseText || '—'}</pre>
              </div>
              {detail.validationNotes && (
                <div>
                  <label className="form-label">Validation Notes</label>
                  <pre className="code-box">{detail.validationNotes}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
