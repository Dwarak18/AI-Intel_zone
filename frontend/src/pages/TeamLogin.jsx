import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginTeam } from '../api/auth.js';

export default function TeamLogin() {
  const [creds, setCreds] = useState({ teamCode: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginTeam(creds.teamCode.toUpperCase(), creds.password);
      navigate('/team/console');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100">
      <div className="card" style={{ width: 420 }}>
        <div className="card-header text-center py-3">
          <i className="bi bi-terminal-fill text-warning fs-2 d-block mb-1" />
          <h5 className="mb-0 fw-bold">Team Access Portal</h5>
          <small className="text-muted">AI Intelligence Zone — Mission Console</small>
        </div>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Team Code</label>
              <input
                className="form-control bg-dark border-secondary text-white text-uppercase"
                placeholder="e.g. ALPHA-01"
                value={creds.teamCode}
                onChange={e => setCreds({ ...creds, teamCode: e.target.value })}
                autoFocus required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control bg-dark border-secondary text-white"
                value={creds.password}
                onChange={e => setCreds({ ...creds, password: e.target.value })}
                required
              />
            </div>
            <button className="btn btn-warning w-100 text-dark fw-bold" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              <i className="bi bi-terminal me-1" />
              Access Mission Console
            </button>
          </form>
          <div className="text-center mt-3">
            <a href="/login" className="text-muted small">Admin Login →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
