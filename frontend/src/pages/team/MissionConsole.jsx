import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { getMissions, getMission, submitAnswer, sandboxAnswer, getMissionHistory } from '../../api/team.js';
import { getStoredUser, clearAuth } from '../../api/client.js';

const BASE_URL = import.meta.env.VITE_API_URL || '';

function ResultPanel({ result }) {
  if (!result) return null;
  const ok = result.status === 'valid' || result.validation?.overallStatus === 'valid';
  return (
    <div className={`alert ${ok ? 'alert-success' : 'alert-danger'} mt-3`}>
      <div className="d-flex justify-content-between align-items-center mb-1">
        <strong><i className={`bi ${ok ? 'bi-check-circle-fill' : 'bi-x-octagon-fill'} me-2`} />
          {result.status || result.validation?.overallStatus}
        </strong>
        {result.score != null && <span className="fs-5 fw-bold">+{result.score?.toFixed?.(1) ?? result.score} pts</span>}
      </div>
      {result.message && <div className="small">{result.message}</div>}
      {result.validation?.feedback && <div className="small mt-1">{result.validation.feedback}</div>}
      {result.error && <div className="small text-warning mt-1">{result.error}</div>}
    </div>
  );
}

export default function MissionConsole() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [missions, setMissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ prompt_text: '', ai_response: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sandboxing, setSandboxing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('mission'); // mission | history | leaderboard
  const consoleRef = useRef(null);
  const socketRef = useRef(null);
  const [liveRank, setLiveRank] = useState(null);

  async function loadMissions() {
    try {
      const d = await getMissions();
      setMissions(d.missions || []);
      if (!selected && d.missions?.length > 0) selectMission(d.missions[0]);
    } catch (err) { setError(err.message); }
  }

  async function selectMission(m) {
    setSelected(m);
    setResult(null);
    try {
      const full = await getMission(m.id);
      setSelected(full.mission || full);
    } catch {}
    try {
      const hist = await getMissionHistory(m.id);
      setHistory(hist.history || hist.submissions || []);
    } catch { setHistory([]); }
  }

  function scrollConsole() {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }

  useEffect(() => {
    loadMissions();

    // Socket.IO for live rank updates
    const token = localStorage.getItem('arena_token');
    const socket = io(`${BASE_URL}/team`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('score_update', (data) => {
      setLiveRank(data);
    });
    return () => socket.disconnect();
  }, []);

  function handleLogout() {
    clearAuth();
    navigate('/team-login');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await submitAnswer({
        mission_id: selected.id,
        prompt_text: form.prompt_text,
        ai_response: form.ai_response,
      });
      setResult(res);
      // Reload history
      const hist = await getMissionHistory(selected.id);
      setHistory(hist.history || hist.submissions || []);
      scrollConsole();
    } catch (err) {
      setResult({ error: err.message, status: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSandbox(e) {
    e.preventDefault();
    if (!selected) return;
    setSandboxing(true);
    setResult(null);
    try {
      const res = await sandboxAnswer({
        mission_id: selected.id,
        prompt_text: form.prompt_text,
        ai_response: form.ai_response,
      });
      setResult({ ...res, sandbox: true });
    } catch (err) {
      setResult({ error: err.message, status: 'error' });
    } finally {
      setSandboxing(false);
    }
  }

  const DIFF_COLOR = { easy: 'success', medium: 'warning', hard: 'danger', extreme: 'danger' };

  return (
    <div id="missionConsole" style={{ background: '#0d1117', minHeight: '100vh' }}>
      {/* Top navbar */}
      <nav className="navbar px-3 border-bottom" style={{ background: '#161b22', borderColor: '#30363d' }}>
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-terminal-fill text-warning" />
          <span className="fw-bold">Mission Console</span>
        </div>
        <div className="d-flex align-items-center gap-3">
          {liveRank && (
            <div className="text-center">
              <span className="text-muted small">Rank </span>
              <span className="fw-bold text-warning">#{liveRank.rank}</span>
              <span className="text-muted small ms-2">{liveRank.totalScore?.toFixed(1)} pts</span>
            </div>
          )}
          <span className="text-muted small">{user?.display_name || user?.username}</span>
          <button className="btn btn-sm btn-outline-danger" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right" />
          </button>
        </div>
      </nav>

      <div className="container-fluid p-0" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 'calc(100vh - 56px)' }}>
        {/* Mission list sidebar */}
        <div className="border-end p-3" style={{ borderColor: '#30363d', background: '#161b22', overflowY: 'auto' }}>
          <div className="text-muted small fw-semibold mb-2 px-1">MISSIONS</div>
          <div className="d-flex flex-column gap-1">
            {missions.map(m => (
              <button
                key={m.id}
                className={`btn text-start p-2 ${selected?.id === m.id ? 'btn-primary' : 'btn-outline-secondary border-0'}`}
                onClick={() => selectMission(m)}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <span className="fw-semibold small">{m.missionCode || m.mission_code}</span>
                  <span className={`badge bg-${DIFF_COLOR[m.difficulty] || 'secondary'}`}
                    style={{ fontSize: '.65rem' }}>{m.difficulty}</span>
                </div>
                <div className="text-truncate" style={{ fontSize: '.75rem', opacity: .8 }}>{m.title}</div>
                <div style={{ fontSize: '.7rem', opacity: .6 }}>{m.maxPoints || m.max_points} pts · {m.category}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div className="p-4" style={{ overflowY: 'auto' }}>
          {error && <div className="alert alert-danger">{error}</div>}

          {!selected && (
            <div className="text-center text-muted py-5">
              <i className="bi bi-cpu fs-1 d-block mb-2" />
              Select a mission to begin
            </div>
          )}

          {selected && (
            <>
              {/* Mission header */}
              <div className="d-flex align-items-start justify-content-between mb-3">
                <div>
                  <h4 className="mb-0 fw-bold">{selected.title}</h4>
                  <div className="d-flex gap-2 mt-1">
                    <span className="badge bg-secondary font-monospace">{selected.missionCode || selected.mission_code}</span>
                    <span className={`badge bg-${DIFF_COLOR[selected.difficulty] || 'secondary'}`}>{selected.difficulty}</span>
                    <span className="badge bg-dark border border-secondary">{selected.maxPoints || selected.max_points} pts</span>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  {['mission', 'history'].map(t => (
                    <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setTab(t)}>
                      {t === 'mission' ? <><i className="bi bi-cpu me-1" />Mission</> : <><i className="bi bi-clock-history me-1" />History ({history.length})</>}
                    </button>
                  ))}
                </div>
              </div>

              {tab === 'mission' && (
                <>
                  {/* Problem statement */}
                  <div className="card mb-3">
                    <div className="card-header fw-semibold small text-muted">PROBLEM STATEMENT</div>
                    <div className="card-body small" style={{ whiteSpace: 'pre-wrap' }}>
                      {selected.description || selected.objective}
                    </div>
                  </div>

                  {/* Extra fields if available */}
                  {(selected.input_text || selected.inputText) && (
                    <div className="card mb-3">
                      <div className="card-header fw-semibold small text-muted">INPUT DATA</div>
                      <div className="card-body">
                        <pre className="console-output" ref={consoleRef}>{selected.input_text || selected.inputText}</pre>
                      </div>
                    </div>
                  )}
                  {(selected.output_format_hint || selected.outputFormatHint) && (
                    <div className="card mb-3">
                      <div className="card-header fw-semibold small text-muted">EXPECTED OUTPUT FORMAT</div>
                      <div className="card-body small"
                        style={{ whiteSpace: 'pre-wrap', fontFamily: 'Cascadia Code, Fira Code, monospace' }}>
                        {selected.output_format_hint || selected.outputFormatHint}
                      </div>
                    </div>
                  )}

                  {/* Submission form */}
                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label className="form-label fw-semibold small text-muted">YOUR PROMPT TO THE AI</label>
                      <textarea
                        className="form-control code-input"
                        rows={5}
                        placeholder="Enter the prompt you gave to your AI model…"
                        value={form.prompt_text}
                        onChange={e => setForm({ ...form, prompt_text: e.target.value })}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold small text-muted">AI RESPONSE</label>
                      <textarea
                        className="form-control code-input"
                        rows={8}
                        placeholder="Paste the AI model's response here…"
                        value={form.ai_response}
                        onChange={e => setForm({ ...form, ai_response: e.target.value })}
                        required
                      />
                    </div>

                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-outline-info" onClick={handleSandbox}
                        disabled={sandboxing || !form.prompt_text || !form.ai_response}>
                        {sandboxing ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-question-circle me-1" />}
                        Test (no save)
                      </button>
                      <button type="submit" className="btn btn-success"
                        disabled={loading || !form.prompt_text || !form.ai_response}>
                        {loading ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-send-fill me-1" />}
                        Submit Answer
                      </button>
                    </div>
                  </form>

                  <ResultPanel result={result} />
                </>
              )}

              {tab === 'history' && (
                <div className="card">
                  <div className="card-header fw-semibold">Submission History</div>
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 small">
                      <thead>
                        <tr className="text-muted">
                          <th>#</th><th>Time</th><th>Status</th><th>Score</th><th>Confidence</th><th>Flagged</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">No submissions yet</td></tr>}
                        {history.map((s, i) => (
                          <tr key={s.id || i}>
                            <td>#{s.attemptNumber || s.attempt_number || i + 1}</td>
                            <td className="text-muted">{new Date(s.createdAt || s.created_at).toLocaleString()}</td>
                            <td><span className={`badge badge-${s.validationStatus || s.validation_status}`}>{s.validationStatus || s.validation_status}</span></td>
                            <td className="text-success fw-semibold">{s.totalScore ?? s.total_score ?? 0}</td>
                            <td>{((s.confidenceScore ?? s.confidence_score ?? 0) * 100).toFixed(0)}%</td>
                            <td>{s.isFlagged || s.is_flagged ? '⚠️' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
