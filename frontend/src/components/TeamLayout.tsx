import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ReactNode } from 'react';

export default function TeamLayout({ children }: { children: ReactNode }) {
  const { user, team, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => { await logout(); nav('/team-login', { replace: true }); };

  return (
    <div className="d-flex" style={{ minHeight: '100vh', background: '#020617' }}>
      {/* Sidebar */}
      <nav className="arena-sidebar" style={{ '--accent': '#10b981', '--accent2': '#059669' } as React.CSSProperties}>
        <div className="sidebar-brand" style={{ color: '#10b981' }}>
          <span>🛡️</span>
          <span>TEAM PORTAL</span>
        </div>
        <div className="sidebar-section-label">TEAM</div>
        <div className="sidebar-item active">
          <i className="bi bi-terminal-fill" />
          <span>Mission Console</span>
        </div>
        <div style={{ flex: 1 }} />
        <div className="sidebar-user">
          <i className="bi bi-people-fill" />
          <span>{team?.teamCode || user?.username}</span>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right" />
          <span>Logout</span>
        </button>
      </nav>

      {/* Main */}
      <div className="arena-main" style={{ overflow: 'hidden' }}>
        <header className="arena-header" style={{ flexShrink: 0 }}>
          <h1 className="arena-page-title" style={{ color: '#10b981' }}>🎯 Mission Console</h1>
          <div className="d-flex align-items-center gap-2">
            {team && <span className="badge" style={{ background: 'rgba(16,185,129,.2)', color: '#10b981', border: '1px solid rgba(16,185,129,.3)' }}>{team.teamCode}</span>}
          </div>
        </header>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </div>
  );
}
