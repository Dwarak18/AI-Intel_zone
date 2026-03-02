import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../api/auth.js';

export default function Login() {
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginAdmin(creds.username, creds.password);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100">
      <div className="card" style={{ width: 380 }}>
        <div className="card-header text-center py-3">
          <i className="bi bi-cpu-fill text-primary fs-2 d-block mb-1" />
          <h5 className="mb-0 fw-bold">AI Intelligence Zone</h5>
          <small className="text-muted">Admin Control Panel</small>
        </div>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input
                className="form-control bg-dark border-secondary text-white"
                value={creds.username}
                onChange={e => setCreds({ ...creds, username: e.target.value })}
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
            <button className="btn btn-primary w-100" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              Sign In
            </button>
          </form>
          <div className="text-center mt-3">
            <a href="/team-login" className="text-muted small">Team Login →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
