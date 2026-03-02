import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api/client';

interface SecurityEvent {
  id: number; teamCode: string; eventType: string; severity: string;
  status: string; description: string; createdAt: string;
}

export default function SecurityPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.security({ severity: severityFilter, status: statusFilter, page });
      setEvents(r.data.events || []);
      setTotalPages(r.data.totalPages || 1);
    } finally { setLoading(false); }
  }, [severityFilter, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const resolve = async (id: number) => {
    await adminApi.resolveEvent(id);
    showToast('Event resolved');
    load();
  };

  const sevColor: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#8b5cf6' };

  return (
    <AdminLayout>
      {toast && <div className="arena-toast">{toast}</div>}
      <div className="page-header">
        <h1 className="page-title"><i className="bi bi-shield-exclamation me-2 text-accent" />Security Events</h1>
      </div>
      <div className="arena-panel">
        <div className="arena-panel-header d-flex justify-content-between flex-wrap gap-2">
          <span><i className="bi bi-shield me-2" />Events</span>
          <div className="d-flex gap-2">
            <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }} className="form-select form-select-sm" style={{ width: 130 }}>
              <option value="">All severity</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="form-select form-select-sm" style={{ width: 130 }}>
              <option value="">All status</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
        {loading ? <div className="arena-loader">Loading…</div> : (
          <>
            <div className="table-responsive">
              <table className="arena-table">
                <thead><tr><th>Team</th><th>Type</th><th>Severity</th><th>Status</th><th>Description</th><th>Time</th><th>Action</th></tr></thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id}>
                      <td className="mono">{e.teamCode || '—'}</td>
                      <td className="mono" style={{ fontSize: '.8rem' }}>{e.eventType}</td>
                      <td><span style={{ color: sevColor[e.severity] || '#94a3b8', fontWeight: 700, fontSize: '.78rem', textTransform: 'uppercase' }}>{e.severity}</span></td>
                      <td><span className={`badge-status ${e.status === 'open' ? 'warn' : 'valid'}`}>{e.status}</span></td>
                      <td className="text-muted" style={{ fontSize: '.82rem', maxWidth: 280 }}>{e.description}</td>
                      <td className="text-muted" style={{ fontSize: '.78rem' }}>{new Date(e.createdAt).toLocaleString()}</td>
                      <td>
                        {e.status === 'open' && (
                          <button className="btn btn-arena-sm" onClick={() => resolve(e.id)}>
                            <i className="bi bi-check2 me-1" />Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">No events</td></tr>}
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
