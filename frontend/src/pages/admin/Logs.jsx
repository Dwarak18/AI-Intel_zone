import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { getLogs, getLogDetail } from '../../api/admin.js';

export default function AdminLogs() {
  const [data, setData] = useState({ logs: [], teams: [], pagination: {} });
  const [filters, setFilters] = useState({ page: 1, team_id: '', status: '', flagged: '' });
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const p = {};
    if (filters.team_id) p.team_id = filters.team_id;
    if (filters.status) p.status = filters.status;
    if (filters.flagged) p.flagged = filters.flagged;
    p.page = filters.page;
    try { const d = await getLogs(p); setData(d); }
    catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  async function openDetail(logId) {
    try { setDetail(await getLogDetail(logId)); }
    catch (err) { setError(err.message); }
  }

  const { logs = [], teams = [], pagination = {} } = data;

  return (
    <AdminLayout>
      <div className="mb-4">
        <h3 className="mb-0 fw-bold">AI Logs Viewer</h3>
        <small className="text-muted">{pagination.total ?? 0} total log entries</small>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filters */}
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <select className="form-select bg-dark border-secondary text-white" style={{ maxWidth: 180 }}
          value={filters.team_id} onChange={e => setFilters({ ...filters, team_id: e.target.value, page: 1 })}>
          <option value="">All Teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.teamCode} — {t.name}</option>)}
        </select>
        <select className="form-select bg-dark border-secondary text-white" style={{ maxWidth: 150 }}
          value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">All Status</option>
          {['valid','invalid','error','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-select bg-dark border-secondary text-white" style={{ maxWidth: 150 }}
          value={filters.flagged} onChange={e => setFilters({ ...filters, flagged: e.target.value, page: 1 })}>
          <option value="">All</option>
          <option value="1">Suspicious Only</option>
        </select>
        <button className="btn btn-outline-secondary" onClick={() => setFilters({ page: 1, team_id: '', status: '', flagged: '' })}>
          Reset
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 small">
            <thead>
              <tr className="text-muted">
                <th>Time</th><th>Team</th><th>Result</th><th>Parse</th>
                <th>Confidence</th><th>Hallucination</th><th>Injection</th><th>Retry</th><th></th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={9} className="text-center text-muted py-4">No logs found</td></tr>}
              {logs.map(l => (
                <tr key={l.id} className={l.injectionScore > 0.5 ? 'table-danger' : l.hallucinationProbability > 0.7 ? 'table-warning' : ''}>
                  <td className="text-muted">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="font-monospace">{l.teamCode}</td>
                  <td><span className={`badge badge-${l.validationResult}`}>{l.validationResult}</span></td>
                  <td><span className="badge bg-secondary">{l.parseResult}</span></td>
                  <td>{(l.confidenceScore * 100).toFixed(0)}%</td>
                  <td className={l.hallucinationProbability > 0.7 ? 'text-warning fw-bold' : ''}>
                    {(l.hallucinationProbability * 100).toFixed(0)}%
                  </td>
                  <td className={l.injectionScore > 0.5 ? 'text-danger fw-bold' : ''}>
                    {(l.injectionScore * 100).toFixed(0)}%
                  </td>
                  <td>{l.retryAttempt || 0}</td>
                  <td>
                    <button className="btn btn-xs btn-outline-info" style={{ fontSize: '.7rem', padding: '1px 6px' }}
                      onClick={() => openDetail(l.id)}>
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center">
            <small className="text-muted">Page {pagination.page} of {pagination.pages}</small>
            <div className="d-flex gap-1">
              <button className="btn btn-sm btn-outline-secondary" disabled={pagination.page <= 1}
                onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}>‹ Prev</button>
              <button className="btn btn-sm btn-outline-secondary" disabled={pagination.page >= pagination.pages}
                onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}>Next ›</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,.75)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">Log Detail — {detail.teamCode}</h5>
                <button className="btn-close btn-close-white" onClick={() => setDetail(null)} />
              </div>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <div className="row g-3 mb-3">
                  {[['Result', detail.validationResult], ['Parse', detail.parseResult],
                    ['Confidence', `${(detail.confidenceScore * 100).toFixed(1)}%`],
                    ['Hallucination', `${(detail.hallucinationProbability * 100).toFixed(1)}%`],
                    ['Injection', `${(detail.injectionScore * 100).toFixed(1)}%`],
                    ['Retry', detail.retryAttempt]].map(([k, v]) => (
                    <div className="col-md-2" key={k}>
                      <div className="text-muted small">{k}</div>
                      <div className="fw-semibold">{v}</div>
                    </div>
                  ))}
                </div>
                {detail.promptText && <>
                  <h6 className="text-muted">Prompt</h6>
                  <pre className="console-output mb-3" style={{ height: 160 }}>{detail.promptText}</pre>
                </>}
                {detail.aiRawOutput && <>
                  <h6 className="text-muted">AI Raw Output</h6>
                  <pre className="console-output mb-3" style={{ height: 200 }}>{detail.aiRawOutput}</pre>
                </>}
                {detail.rejectionReason && <div className="alert alert-danger">Rejected: {detail.rejectionReason}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
