import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function TeamLoginPage() {
  const { user, loginTeam } = useAuth();
  const nav = useNavigate();
  const [teamCode, setTeamCode] = useState('');
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
      p.style.cssText = `left:${Math.random()*100}%;width:${1+Math.random()*3}px;height:${1+Math.random()*3}px;animation-duration:${9+Math.random()*12}s;animation-delay:${Math.random()*10}s;background:#10b981`;
      container.appendChild(p);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginTeam(teamCode.toUpperCase(), password);
      nav('/team/console', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid team code or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="particles" ref={particleRef} />
      <div className="login-card team">
        <div className="login-brand">
          <div className="login-brand-icon team">🛡️</div>
          <h2 className="team">AI INTEL ZONE</h2>
          <p>Team Access Portal</p>
        </div>
        <div className="glow-line team" />

        {error && <div className="arena-alert arena-alert-err"><i className="bi bi-exclamation-triangle-fill me-2" />{error}</div>}

        <div style={{ background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, padding: '.6rem .85rem', fontSize: '.75rem', color: 'var(--muted)', marginBottom: '1.1rem' }}>
          <i className="bi bi-info-circle me-1" style={{ color: '#34d399' }} />
          Enter your team code (e.g. <strong style={{ color: '#94a3b8', fontFamily: 'monospace' }}>TECH-385276</strong>) and the password provided to your team.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label"><i className="bi bi-people-fill me-1" />Team Code</label>
            <input value={teamCode}
              onChange={e => setTeamCode(e.target.value.toUpperCase())}
              className="form-control mono"
              placeholder="TECH-XXXXXX"
              autoFocus autoComplete="off" required
              style={{ letterSpacing: 1, textTransform: 'uppercase' }} />
          </div>
          <div className="mb-4">
            <label className="form-label"><i className="bi bi-key-fill me-1" />Team Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="form-control" placeholder="Enter team password" required />
          </div>
          <button type="submit" className="btn btn-arena-team w-100 py-2" disabled={loading}>
            {loading ? <><span className="arena-spinner me-2" />Authenticating…</> : <><i className="bi bi-box-arrow-in-right me-2" />Enter Mission Console</>}
          </button>
        </form>

        <div className="glow-line team" />
        <p className="text-center mb-0" style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
          Admin? <a href="/login" className="text-accent">Go to admin login →</a>
        </p>
      </div>
    </div>
  );
}
