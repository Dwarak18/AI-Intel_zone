import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { clearAuth } from '../api/client.js';

const navItems = [
  { to: '/admin', icon: 'bi-speedometer2', label: 'Dashboard', end: true },
  { to: '/admin/teams', icon: 'bi-people-fill', label: 'Teams' },
  { to: '/admin/missions', icon: 'bi-cpu-fill', label: 'Missions' },
  { to: '/admin/leaderboard', icon: 'bi-trophy-fill', label: 'Leaderboard' },
  { to: '/admin/live-scores', icon: 'bi-broadcast', label: 'Live Scores' },
  { to: '/admin/activity', icon: 'bi-activity', label: 'Activity' },
  { to: '/admin/logs', icon: 'bi-journal-code', label: 'AI Logs' },
  { to: '/admin/security', icon: 'bi-shield-fill-exclamation', label: 'Security' },
  { to: '/admin/audit', icon: 'bi-clock-history', label: 'Audit Trail' },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <>
      {/* Sidebar */}
      <nav id="adminSidebar">
        <div className="sidebar-brand">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-cpu-fill text-primary fs-4" />
            <div>
              <div className="fw-bold text-white" style={{ fontSize: '.9rem' }}>AI Intel Zone</div>
              <div className="text-muted" style={{ fontSize: '.7rem' }}>Control Arena v2</div>
            </div>
          </div>
        </div>
        <nav className="nav flex-column p-2 gap-1 mt-1">
          {navItems.map(({ to, icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className={`bi ${icon}`} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="position-absolute bottom-0 w-100 p-2 border-top border-secondary">
          <button onClick={handleLogout} className="btn btn-outline-danger btn-sm w-100">
            <i className="bi bi-box-arrow-right me-1" /> Logout
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div id="adminContent" className="p-4">
        {children}
      </div>
    </>
  );
}
