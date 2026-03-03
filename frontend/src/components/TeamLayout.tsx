import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ReactNode, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api/client';

interface TimerState { status: string; remainingSeconds: number; totalSeconds: number; }

function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TeamLayout({ children }: { children: ReactNode }) {
  const { user, team, logout } = useAuth();
  const nav = useNavigate();
  const [timerStatus, setTimerStatus] = useState<TimerState | null>(null);
  const sockRef = useRef<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    const sock = io('/team', { auth: { token: getToken() }, transports: ['websocket', 'polling'] });
    sock.on('timer_tick', (data: TimerState) => setTimerStatus(data));
    sockRef.current = sock;
    return () => { sock.disconnect(); };
  }, []);

  const handleLogout = async () => { await logout(); nav('/team-login', { replace: true }); };

  const timerColor = timerStatus?.status === 'running'
    ? timerStatus.remainingSeconds < 300 ? '#ef4444' : '#10b981'
    : timerStatus?.status === 'paused' ? '#f59e0b'
    : timerStatus?.status === 'finished' ? '#ef4444'
    : 'var(--muted)';

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
          <div className="d-flex align-items-center gap-3">
            {/* Game timer widget */}
            {timerStatus && timerStatus.status !== 'idle' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: timerColor + '18', border: `1px solid ${timerColor}44`,
                borderRadius: 8, padding: '4px 14px',
              }}>
                <i className="bi bi-stopwatch-fill" style={{ color: timerColor, fontSize: '0.9rem' }} />
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.05rem', color: timerColor }}>
                  {timerStatus.status === 'finished' ? 'TIME UP' : fmtTime(timerStatus.remainingSeconds)}
                </span>
                {timerStatus.status === 'paused' && (
                  <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: 2 }}>PAUSED</span>
                )}
              </div>
            )}
            {team && <span className="badge" style={{ background: 'rgba(16,185,129,.2)', color: '#10b981', border: '1px solid rgba(16,185,129,.3)' }}>{team.teamCode}</span>}
          </div>
        </header>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </div>
  );
}
