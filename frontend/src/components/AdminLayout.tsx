import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ReactNode } from 'react';

const navItems = [
  { to: '/admin/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
  { to: '/admin/timer', icon: 'bi-stopwatch-fill', label: 'Game Timer' },
  { to: '/admin/teams', icon: 'bi-people-fill', label: 'Teams' },
  { to: '/admin/missions', icon: 'bi-trophy-fill', label: 'Missions' },
  { to: '/admin/leaderboard', icon: 'bi-bar-chart-fill', label: 'Leaderboard' },
  { to: '/admin/logs', icon: 'bi-journal-text', label: 'AI Logs' },
  { to: '/admin/security', icon: 'bi-shield-exclamation', label: 'Security' },
  { to: '/admin/audit', icon: 'bi-clock-history', label: 'Audit Trail' },
];

export default function AdminLayout({ title, children }: { title?: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => { await logout(); nav('/login', { replace: true }); };

  return (
    <div className="d-flex" style={{ minHeight: '100vh', background: '#020617' }}>
      {/* Sidebar */}
      <nav className="arena-sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon-sm">⚡</span>
          <span>AI INTEL ZONE</span>
        </div>
        <div className="sidebar-section-label">NAVIGATION</div>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
            <i className={`bi ${item.icon}`} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <div className="sidebar-user">
          <i className="bi bi-person-circle" />
          <span>{user?.username}</span>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right" />
          <span>Logout</span>
        </button>
      </nav>

      {/* Main content */}
      <div className="arena-main">
        <header className="arena-header">
          <h1 className="arena-page-title">{title}</h1>
          <div className="d-flex align-items-center gap-2">
            <span className="arena-live-badge"><span className="live-dot" />LIVE</span>
          </div>
        </header>
        <main className="arena-content">{children}</main>
      </div>
    </div>
  );
}
