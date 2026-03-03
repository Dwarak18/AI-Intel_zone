import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api/client';
import { getToken } from '../../api/client';

interface TimerState {
  status: 'idle' | 'running' | 'paused' | 'finished';
  totalSeconds: number;
  remainingSeconds: number;
  startedAt: string | null;
  pausedAt: string | null;
}

const PRESETS = [
  { label: '15 min', seconds: 900 },
  { label: '30 min', seconds: 1800 },
  { label: '45 min', seconds: 2700 },
  { label: '60 min', seconds: 3600 },
  { label: '90 min', seconds: 5400 },
  { label: '120 min', seconds: 7200 },
];

function fmt(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pct(remaining: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((remaining / total) * 100);
}

const STATUS_COLOR: Record<string, string> = {
  idle: '#6366f1',
  running: '#10b981',
  paused: '#f59e0b',
  finished: '#ef4444',
};

export default function TimerPage() {
  const [timer, setTimer] = useState<TimerState>({
    status: 'idle', totalSeconds: 3600, remainingSeconds: 3600,
    startedAt: null, pausedAt: null,
  });
  const [customMinutes, setCustomMinutes] = useState('60');
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Load initial state
  useEffect(() => {
    adminApi.timerState().then(r => setTimer(r.data)).catch(() => {});
  }, []);

  // Connect to Socket.IO admin namespace for real-time ticks
  useEffect(() => {
    const token = getToken();
    const sock = io('/admin', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    sock.on('timer_tick', (data: TimerState) => setTimer(data));
    socketRef.current = sock;
    return () => { sock.disconnect(); };
  }, []);

  const run = useCallback(async (fn: () => Promise<any>) => {
    setBusy(true);
    try { const r = await fn(); setTimer(r.data); }
    catch (e: any) { alert(e.response?.data?.error || 'Request failed'); }
    finally { setBusy(false); }
  }, []);

  const handleStart = () => {
    const secs = parseInt(customMinutes) * 60;
    if (isNaN(secs) || secs < 60) return alert('Minimum 1 minute');
    run(() => adminApi.timerStart(secs));
  };
  const handlePreset = (secs: number) => {
    setCustomMinutes(String(secs / 60));
    run(() => adminApi.timerStart(secs));
  };
  const handlePause  = () => run(() => adminApi.timerPause());
  const handleResume = () => run(() => adminApi.timerResume());
  const handleReset  = () => { if (confirm('Reset timer?')) run(() => adminApi.timerReset()); };
  const handleAdjust = (delta: number) => run(() => adminApi.timerAdjust(delta));

  const { status, remainingSeconds, totalSeconds } = timer;
  const progress = pct(remainingSeconds, totalSeconds);
  const color = STATUS_COLOR[status] || '#6366f1';
  const circumference = 2 * Math.PI * 110; // r=110
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title"><i className="bi bi-stopwatch-fill me-2 text-accent" />Game Timer</h1>
        <span className={`page-badge`} style={{ background: color + '22', color }}>
          {status.toUpperCase()}
        </span>
      </div>

      {/* Main timer display */}
      <div className="arena-panel mb-4" style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem 1rem' }}>
        <div style={{ position: 'relative', width: 260, height: 260 }}>
          <svg width="260" height="260" style={{ transform: 'rotate(-90deg)' }}>
            {/* Track */}
            <circle cx="130" cy="130" r="110" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
            {/* Progress */}
            <circle
              cx="130" cy="130" r="110" fill="none"
              stroke={color} strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.4s' }}
            />
          </svg>
          {/* Time text */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: '2.8rem', fontWeight: 700, color, letterSpacing: 2 }}>
              {fmt(remainingSeconds)}
            </span>
            <span style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 4 }}>
              {progress}% remaining
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="arena-panel mb-4">
        <div className="arena-panel-header"><span><i className="bi bi-sliders me-2" />Controls</span></div>
        <div style={{ padding: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {status === 'idle' || status === 'finished' ? (
            <button className="btn btn-arena" onClick={handleStart} disabled={busy} style={{ minWidth: 110 }}>
              <i className="bi bi-play-fill me-2" />Start
            </button>
          ) : status === 'running' ? (
            <button className="btn btn-arena" onClick={handlePause} disabled={busy} style={{ minWidth: 110, background: '#f59e0b22', borderColor: '#f59e0b', color: '#f59e0b' }}>
              <i className="bi bi-pause-fill me-2" />Pause
            </button>
          ) : (
            <button className="btn btn-arena" onClick={handleResume} disabled={busy} style={{ minWidth: 110, background: '#10b98122', borderColor: '#10b981', color: '#10b981' }}>
              <i className="bi bi-play-fill me-2" />Resume
            </button>
          )}

          <button className="btn btn-arena" onClick={handleReset} disabled={busy}
            style={{ minWidth: 110, background: '#ef444422', borderColor: '#ef4444', color: '#ef4444' }}>
            <i className="bi bi-arrow-counterclockwise me-2" />Reset
          </button>

          <div className="d-flex align-items-center gap-2 ms-auto">
            <label style={{ color: 'var(--muted)', fontSize: '.85rem', whiteSpace: 'nowrap' }}>Custom (min)</label>
            <input
              type="number" min="1" max="480"
              value={customMinutes}
              onChange={e => setCustomMinutes(e.target.value)}
              className="form-control mono"
              style={{ width: 90 }}
            />
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="arena-panel mb-4">
        <div className="arena-panel-header"><span><i className="bi bi-clock me-2" />Duration Presets</span></div>
        <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.seconds} className="btn btn-arena-sm" onClick={() => handlePreset(p.seconds)} disabled={busy}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time adjustments */}
      <div className="arena-panel mb-4">
        <div className="arena-panel-header"><span><i className="bi bi-plus-slash-minus me-2" />Adjust Time</span></div>
        <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[-600, -300, -60, 60, 300, 600].map(d => (
            <button key={d} className={`btn btn-arena-sm${d < 0 ? ' danger' : ''}`}
              style={d < 0 ? { borderColor: '#ef4444', color: '#ef4444', background: '#ef444415' } : {}}
              onClick={() => handleAdjust(d)} disabled={busy}>
              {d > 0 ? '+' : ''}{d / 60} min
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="arena-panel">
        <div style={{ padding: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <div className="stat-label">Total Duration</div>
            <div className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(totalSeconds)}</div>
          </div>
          <div>
            <div className="stat-label">Elapsed</div>
            <div className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(totalSeconds - remainingSeconds)}</div>
          </div>
          <div>
            <div className="stat-label">Remaining</div>
            <div className="mono" style={{ color, fontWeight: 600 }}>{fmt(remainingSeconds)}</div>
          </div>
          <div>
            <div className="stat-label">Progress</div>
            <div className="mono" style={{ color, fontWeight: 600 }}>{100 - progress}% elapsed</div>
          </div>
          {timer.startedAt && (
            <div>
              <div className="stat-label">Started At</div>
              <div className="mono" style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                {new Date(timer.startedAt).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
