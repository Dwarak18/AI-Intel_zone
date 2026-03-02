import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { user, loginAdmin } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const particleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) nav(user.isAdmin ? '/admin/dashboard' : '/team/console', { replace: true });
  }, [user, nav]);

  useEffect(() => {
    const container = particleRef.current;
    if (!container) return;
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.cssText = `left:${Math.random()*100}%;width:${1+Math.random()*3}px;height:${1+Math.random()*3}px;animation-duration:${9+Math.random()*12}s;animation-delay:${Math.random()*10}s`;
      container.appendChild(p);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginAdmin(username, password);
      nav('/admin/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="particles" ref={particleRef} />
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">⚡</div>
          <h2>AI INTEL ZONE</h2>
          <p>Control Arena v2.0</p>
        </div>
        <div className="glow-line" />

        {error && <div className="arena-alert arena-alert-err"><i className="bi bi-exclamation-triangle-fill me-2" />{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label"><i className="bi bi-person-fill me-1" />Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              className="form-control" placeholder="Enter admin username"
              autoFocus autoComplete="username" required />
          </div>
          <div className="mb-4">
            <label className="form-label"><i className="bi bi-lock-fill me-1" />Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="form-control" placeholder="Enter password"
              autoComplete="current-password" required />
          </div>
          <button type="submit" className="btn btn-arena w-100 py-2" disabled={loading}>
            {loading ? <><span className="arena-spinner me-2" />Authenticating…</> : <><i className="bi bi-shield-lock-fill me-2" />Authenticate</>}
          </button>
        </form>

        <div className="glow-line" />
        <p className="text-center mb-1" style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
          Team member? <a href="/team-login" className="text-success">Go to team login →</a>
        </p>
        <p className="text-center mb-0" style={{ fontSize: '.65rem', color: 'var(--border2)' }}>
          Authorized personnel only · All access is logged
        </p>
      </div>
    </div>
  );
}
