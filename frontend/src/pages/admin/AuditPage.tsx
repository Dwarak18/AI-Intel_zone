import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api/client';

interface AuditEntry {
  id: number; action: string; severity: string; actorId: string; targetType: string;
  targetId: string; details: string; ipAddress: string; createdAt: string;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.audit({ action: actionFilter, severity: severityFilter, page });
      setEntries(r.data.logs || r.data.entries || []);
      setTotalPages(r.data.totalPages || 1);
    } finally { setLoading(false); }
  }, [actionFilter, severityFilter, page]);

  useEffect(() => { load(); }, [load]);

  const sevColor: Record<string, string> = {
    info: '#6366f1', warning: '#f59e0b', error: '#ef4444', critical: '#8b5cf6'
  };

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title"><i className="bi bi-clock-history me-2 text-accent" />Audit Trail</h1>
      </div>
      <div className="arena-panel">
        <div className="arena-panel-header d-flex justify-content-between flex-wrap gap-2">
          <span><i className="bi bi-list-check me-2" />All system actions</span>
          <div className="d-flex gap-2">
            <input value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="form-control form-control-sm" placeholder="Filter action…" style={{ width: 160 }} />
            <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }} className="form-select form-select-sm" style={{ width: 130 }}>
              <option value="">All severity</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        {loading ? <div className="arena-loader">Loading…</div> : (
          <>
            <div className="table-responsive">
              <table className="arena-table">
                <thead><tr><th>Action</th><th>Severity</th><th>Actor</th><th>Target</th><th>Details</th><th>IP</th><th>Time</th></tr></thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id}>
                      <td className="mono" style={{ fontSize: '.8rem' }}>{e.action}</td>
                      <td><span style={{ color: sevColor[e.severity] || '#94a3b8', fontWeight: 700, fontSize: '.78rem', textTransform: 'uppercase' }}>{e.severity}</span></td>
                      <td className="mono" style={{ fontSize: '.78rem' }}>{e.actorId || '—'}</td>
                      <td className="mono" style={{ fontSize: '.78rem' }}>{e.targetType ? `${e.targetType}:${e.targetId}` : '—'}</td>
                      <td className="text-muted" style={{ fontSize: '.8rem', maxWidth: 260 }}>{e.details || '—'}</td>
                      <td className="mono" style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{e.ipAddress || '—'}</td>
                      <td className="text-muted" style={{ fontSize: '.75rem' }}>{new Date(e.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {entries.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">No audit records</td></tr>}
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
    </AdminLayout>
  );
}
