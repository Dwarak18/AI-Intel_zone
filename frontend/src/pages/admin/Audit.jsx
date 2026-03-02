import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { getAuditLogs } from '../../api/admin.js';

const SEVERITY_CLASS = { critical: 'danger', warning: 'warning', info: 'info', debug: 'secondary' };

export default function AdminAudit() {
  const [data, setData] = useState({ logs: [], actionList: [], pagination: {} });
  const [filters, setFilters] = useState({ page: 1, action: '', severity: '' });
  const [error, setError] = useState('');

  async function load() {
    const p = {};
    if (filters.action) p.action = filters.action;
    if (filters.severity) p.severity = filters.severity;
    p.page = filters.page;
    try { const d = await getAuditLogs(p); setData(d); }
    catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  const { logs = [], actionList = [], pagination = {} } = data;

  return (
    <AdminLayout>
      <div className="mb-4">
        <h3 className="mb-0 fw-bold">Audit Trail</h3>
        <small className="text-muted">{pagination.total ?? 0} total entries</small>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filters */}
      <div className="d-flex gap-2 mb-3">
        <select className="form-select bg-dark border-secondary text-white" style={{ maxWidth: 220 }}
          value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value, page: 1 })}>
          <option value="">All Actions</option>
          {actionList.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="form-select bg-dark border-secondary text-white" style={{ maxWidth: 160 }}
          value={filters.severity} onChange={e => setFilters({ ...filters, severity: e.target.value, page: 1 })}>
          <option value="">All Severities</option>
          {['critical','warning','info','debug'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-outline-secondary" onClick={() => setFilters({ page: 1, action: '', severity: '' })}>
          Reset
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 small">
            <thead>
              <tr className="text-muted">
                <th>Time</th><th>Action</th><th>Severity</th>
                <th>Description</th><th>User</th><th>Resource</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">No audit entries</td></tr>}
              {logs.map(l => (
                <tr key={l.id} className={l.severity === 'critical' ? 'table-danger' : l.severity === 'warning' ? 'table-warning' : ''}>
                  <td className="text-muted">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="font-monospace">{l.action}</td>
                  <td><span className={`badge bg-${SEVERITY_CLASS[l.severity] || 'secondary'}`}>{l.severity}</span></td>
                  <td className="text-truncate" style={{ maxWidth: 300 }}>{l.description}</td>
                  <td className="text-muted">{l.userId || '—'}</td>
                  <td className="text-muted">{l.resourceType ? `${l.resourceType} #${l.resourceId}` : '—'}</td>
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
    </AdminLayout>
  );
}
