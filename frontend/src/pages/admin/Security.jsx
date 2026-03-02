import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { getSecurityEvents, resolveSecurityEvent } from '../../api/admin.js';

const SEVERITY_CLASS = { critical: 'danger', high: 'warning', medium: 'info', low: 'secondary' };

export default function AdminSecurity() {
  const [data, setData] = useState({ events: [], summary: {}, pagination: {} });
  const [filters, setFilters] = useState({ page: 1, severity: '', status: '' });
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveForm, setResolveForm] = useState({ status: 'resolved', notes: '' });
  const [error, setError] = useState('');

  async function load() {
    const p = {};
    if (filters.severity) p.severity = filters.severity;
    if (filters.status) p.status = filters.status;
    p.page = filters.page;
    try { const d = await getSecurityEvents(p); setData(d); }
    catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  async function handleResolve(e) {
    e.preventDefault();
    try {
      await resolveSecurityEvent(resolveModal.id, resolveForm);
      setResolveModal(null);
      load();
    } catch (err) { setError(err.message); }
  }

  const { events = [], summary = {}, pagination = {} } = data;

  return (
    <AdminLayout>
      <div className="mb-4">
        <h3 className="mb-0 fw-bold">Security Events</h3>
        <small className="text-muted">
          {summary.total ?? 0} total · {summary.critical ?? 0} critical · {summary.open ?? 0} open
        </small>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card text-center py-2 border-danger">
            <div className="fs-2 fw-bold text-danger">{summary.critical ?? 0}</div>
            <div className="text-muted small">Critical Events</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center py-2 border-warning">
            <div className="fs-2 fw-bold text-warning">{summary.open ?? 0}</div>
            <div className="text-muted small">Open Events</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center py-2">
            <div className="fs-2 fw-bold">{summary.total ?? 0}</div>
            <div className="text-muted small">Total Events</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="d-flex gap-2 mb-3">
        <select className="form-select bg-dark border-secondary text-white" style={{ maxWidth: 160 }}
          value={filters.severity} onChange={e => setFilters({ ...filters, severity: e.target.value, page: 1 })}>
          <option value="">All Severities</option>
          {['critical','high','medium','low'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-select bg-dark border-secondary text-white" style={{ maxWidth: 160 }}
          value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">All Status</option>
          {['open','resolved','dismissed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 small">
            <thead>
              <tr className="text-muted">
                <th>Time</th><th>Type</th><th>Severity</th><th>Description</th>
                <th>IP</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">No security events</td></tr>}
              {events.map(ev => (
                <tr key={ev.id} className={ev.severity === 'critical' ? 'table-danger' : ev.severity === 'high' ? 'table-warning' : ''}>
                  <td className="text-muted">{new Date(ev.createdAt).toLocaleString()}</td>
                  <td className="font-monospace">{ev.eventType}</td>
                  <td><span className={`badge bg-${SEVERITY_CLASS[ev.severity] || 'secondary'}`}>{ev.severity}</span></td>
                  <td className="text-truncate" style={{ maxWidth: 300 }}>{ev.description}</td>
                  <td className="font-monospace text-muted">{ev.ipAddress || '—'}</td>
                  <td><span className={`badge ${ev.status === 'open' ? 'bg-danger' : 'bg-success'}`}>{ev.status}</span></td>
                  <td>
                    {ev.status === 'open' && (
                      <button className="btn btn-sm btn-outline-success" style={{ fontSize: '.7rem', padding: '2px 8px' }}
                        onClick={() => { setResolveModal(ev); setResolveForm({ status: 'resolved', notes: '' }); }}>
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center">
            <small className="text-muted">Page {pagination.page} of {pagination.pages}</small>
            <div className="d-flex gap-1">
              <button className="btn btn-sm btn-outline-secondary" disabled={pagination.page <= 1}
                onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}>‹</button>
              <button className="btn btn-sm btn-outline-secondary" disabled={pagination.page >= pagination.pages}
                onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}>›</button>
            </div>
          </div>
        )}
      </div>

      {resolveModal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,.7)' }}>
          <div className="modal-dialog">
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">Resolve Event #{resolveModal.id}</h5>
                <button className="btn-close btn-close-white" onClick={() => setResolveModal(null)} />
              </div>
              <form onSubmit={handleResolve}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Resolution</label>
                    <select className="form-select bg-dark border-secondary text-white"
                      value={resolveForm.status} onChange={e => setResolveForm({ ...resolveForm, status: e.target.value })}>
                      <option value="resolved">Resolved</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea className="form-control bg-dark border-secondary text-white" rows={3}
                      value={resolveForm.notes} onChange={e => setResolveForm({ ...resolveForm, notes: e.target.value })} />
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button type="button" className="btn btn-secondary" onClick={() => setResolveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-success">Confirm</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
