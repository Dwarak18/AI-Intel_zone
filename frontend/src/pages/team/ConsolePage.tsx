import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import TeamLayout from '../../components/TeamLayout';
import { teamApi } from '../../api/client';

interface Mission {
  id: number; missionCode: string; title: string; difficulty: string;
  description: string; objective: string; inputText: string; outputFormatHint: string;
  maxPoints: number; maxRetries: number; isVisible: boolean;
  attemptsUsed?: number; bestScore?: number;
}
interface SubmitResult {
  status: string; score: number; message: string;
  confidence?: number; hallucinationScore?: number;
  validationNotes?: string; attemptsUsed?: number;
}
interface HistoryEntry { id: number; validationStatus: string; scoreAwarded: number; createdAt: string; attemptNumber: number; }

export default function ConsolePage() {
  const { user, team } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selected, setSelected] = useState<Mission | null>(null);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sandboxing, setSandboxing] = useState(false);
  const [jsonError, setJsonError] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [tab, setTab] = useState<'brief' | 'history' | 'leaderboard'>('brief');
  const responseRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      try { const r = await teamApi.missions(); setMissions(r.data.missions || []); }
      finally { setLoadingMissions(false); }
      try { const lr = await teamApi.leaderboard(); setLeaderboard(lr.data.leaderboard || []); } catch {}
    })();
  }, []);

  const selectMission = async (m: Mission) => {
    setSelected(m); setResult(null); setPrompt(''); setResponse(''); setJsonError(''); setTab('brief');
    try { const r = await teamApi.missionHistory(m.id); setHistory(r.data.submissions || []); } catch {}
  };

  const validateJson = (val: string) => {
    if (!val.trim()) { setJsonError(''); return true; }
    try { JSON.parse(val); setJsonError(''); return true; }
    catch (e: any) { setJsonError(e.message); return false; }
  };

  const handleSubmit = async () => {
    if (!selected || !prompt.trim()) return;
    if (selected.outputFormatHint?.includes('json') && !validateJson(response)) return;
    setSubmitting(true); setResult(null);
    try {
      const r = await teamApi.submit({
        mission_id: selected.id,
        prompt_text: prompt,
        ai_response: response,
      });
      const d = r.data;
      setResult({
        status: d.status || d.validation?.status || 'error',
        score: d.score?.total ?? 0,
        message: d.validation?.feedback || d.message || '',
        confidence: d.score?.confidence,
        hallucinationScore: undefined,
        validationNotes: d.validation?.errors?.join('; ') || undefined,
        attemptsUsed: d.attemptNumber,
      });
      // refresh history (drives attemptsLeft counter)
      const hr = await teamApi.missionHistory(selected.id);
      setHistory(hr.data.submissions || []);
      // refresh leaderboard
      const lr = await teamApi.leaderboard();
      setLeaderboard(lr.data.leaderboard || []);
    } catch (err: any) {
      setResult({ status: 'error', score: 0, message: err.response?.data?.error || 'Submission failed' });
    } finally { setSubmitting(false); }
  };

  const handleSandbox = async () => {
    if (!selected || !prompt.trim()) return;
    setSandboxing(true); setResult(null);
    try {
      const r = await teamApi.sandbox({
        mission_id: selected.id,
        prompt_text: prompt,
        ai_response: response,
      });
      const v = r.data.validation || {};
      setResult({
        status: v.status || 'error',
        score: 0,
        message: '[SANDBOX] ' + (v.feedback || v.message || ''),
        confidence: v.confidence,
        validationNotes: v.errors?.join('; ') || undefined,
      });
    } catch (err: any) {
      setResult({ status: 'error', score: 0, message: err.response?.data?.error || 'Sandbox failed' });
    } finally { setSandboxing(false); }
  };

  const diffColor: Record<string, string> = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444', expert: '#8b5cf6' };
  // attemptsLeft derived from history (updated after each submit)
  const attemptsLeft = selected ? Math.max(0, selected.maxRetries - history.length) : 0;

  return (
    <TeamLayout>
      <div className="console-grid">
        {/* Mission list */}
        <div className="console-mission-list">
          <div className="console-mission-list-header">
            <i className="bi bi-journal-code me-2" />Missions
          </div>
          {loadingMissions ? <div className="arena-loader small">Loading…</div> : (
            missions.filter(m => m.isVisible).map(m => (
              <div key={m.id}
                className={`console-mission-item ${selected?.id === m.id ? 'active' : ''}`}
                onClick={() => selectMission(m)}>
                <div className="d-flex justify-content-between align-items-start">
                  <span className="mono" style={{ fontSize: '.82rem' }}>{m.missionCode}</span>
                  <span style={{ fontSize: '.72rem', color: diffColor[m.difficulty] || '#94a3b8', fontWeight: 700 }}>
                    {m.difficulty?.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 2 }}>{m.title}</div>
                {(m.bestScore ?? 0) > 0 && (
                  <div style={{ fontSize: '.72rem', color: '#10b981', marginTop: 2 }}>
                    <i className="bi bi-check-circle-fill me-1" />Best: {m.bestScore} pts
                  </div>
                )}
              </div>
            ))
          )}
          {!loadingMissions && missions.filter(m => m.isVisible).length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--muted)', fontSize: '.85rem', textAlign: 'center' }}>No missions available</div>
          )}
        </div>

        {/* Main panel */}
        <div className="console-main">
          {!selected ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexDirection: 'column', gap: '.5rem' }}>
              <i className="bi bi-arrow-left-circle" style={{ fontSize: '2rem' }} />
              <span>Select a mission to begin</span>
            </div>
          ) : (
            <>
              <div className="console-mission-header">
                <div>
                  <span className="mono me-3 text-team" style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selected.missionCode}</span>
                  <span style={{ color: diffColor[selected.difficulty] || '#94a3b8', fontSize: '.85rem', fontWeight: 700 }}>{selected.difficulty?.toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-muted me-3" style={{ fontSize: '.82rem' }}>
                    <i className="bi bi-arrow-repeat me-1" />
                    {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left
                  </span>
                  <span className="text-accent mono" style={{ fontSize: '.82rem' }}>
                    <i className="bi bi-star-fill me-1" />max {selected.maxPoints} pts
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="console-tabs">
                {(['brief', 'history', 'leaderboard'] as const).map(t => (
                  <button key={t} className={`console-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                    {t === 'brief' && <><i className="bi bi-file-text me-1" />Brief</>}
                    {t === 'history' && <><i className="bi bi-clock-history me-1" />History ({history.length})</>}
                    {t === 'leaderboard' && <><i className="bi bi-trophy me-1" />Leaderboard</>}
                  </button>
                ))}
              </div>

              {tab === 'brief' && (
                <div className="console-brief">
                  <h6 className="text-team mb-2">{selected.title}</h6>
                  {selected.description && <p style={{ color: '#cbd5e1', fontSize: '.88rem', marginBottom: '1rem' }}>{selected.description}</p>}
                  {selected.objective && (
                    <div className="brief-section">
                      <div className="brief-section-title"><i className="bi bi-bullseye me-1" />Objective</div>
                      <p style={{ marginBottom: 0 }}>{selected.objective}</p>
                    </div>
                  )}
                  {selected.inputText && (
                    <div className="brief-section">
                      <div className="brief-section-title"><i className="bi bi-input-cursor me-1" />Input Data</div>
                      <pre className="code-box">{selected.inputText}</pre>
                    </div>
                  )}
                  {selected.outputFormatHint && (
                    <div className="brief-section">
                      <div className="brief-section-title"><i className="bi bi-braces me-1" />Expected Output Format</div>
                      <pre className="code-box">{selected.outputFormatHint}</pre>
                    </div>
                  )}
                </div>
              )}

              {tab === 'history' && (
                <div className="console-brief">
                  {history.length === 0 ? (
                    <div className="text-center text-muted py-4">No submissions yet</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="arena-table small">
                        <thead><tr><th>#</th><th>Status</th><th>Score</th><th>Time</th></tr></thead>
                        <tbody>
                          {history.map((h, i) => (
                            <tr key={h.id}>
                              <td className="text-muted">{history.length - i}</td>
                              <td><span className={`badge-status ${h.validationStatus}`}>{h.validationStatus}</span></td>
                              <td className="text-accent mono">{h.scoreAwarded}</td>
                              <td className="text-muted" style={{ fontSize: '.78rem' }}>{new Date(h.createdAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === 'leaderboard' && (
                <div className="console-brief">
                  <table className="arena-table small">
                    <thead><tr><th>#</th><th>Team</th><th>Score</th></tr></thead>
                    <tbody>
                      {leaderboard.map((e: any, i: number) => (
                        <tr key={e.teamCode} style={e.teamCode === team?.teamCode ? { background: 'rgba(16,185,129,.08)' } : {}}>
                          <td className="text-muted">{i + 1}</td>
                          <td className="mono" style={{ color: e.teamCode === team?.teamCode ? '#10b981' : undefined }}>{e.teamCode}</td>
                          <td className="mono text-accent">{e.totalScore}</td>
                        </tr>
                      ))}
                      {leaderboard.length === 0 && <tr><td colSpan={3} className="text-center py-3 text-muted">No data yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input panel */}
        <div className="console-input-panel">
          <div className="console-input-header">
            <i className="bi bi-terminal me-2" />Submission
            {selected && <span className="ms-auto text-muted" style={{ fontSize: '.78rem' }}>
              {attemptsLeft <= 1 && attemptsLeft >= 0 && <span style={{ color: attemptsLeft === 0 ? '#ef4444' : '#f59e0b' }}>
                <i className="bi bi-exclamation-triangle me-1" />{attemptsLeft === 0 ? 'No attempts left' : 'Last attempt'}
              </span>}
            </span>}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.8rem', padding: '1rem', overflowY: 'auto' }}>
            <div>
              <label className="form-label"><i className="bi bi-chat-left-text me-1" />Your Prompt</label>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                className="form-control mono" rows={5}
                placeholder="Enter your prompt to the AI model…"
                disabled={!selected || attemptsLeft === 0} />
            </div>

            <div>
              <label className="form-label d-flex justify-content-between">
                <span><i className="bi bi-braces me-1" />AI Response</span>
                {jsonError && <span style={{ color: '#ef4444', fontSize: '.75rem' }}><i className="bi bi-exclamation-circle me-1" />{jsonError}</span>}
              </label>
              <textarea ref={responseRef} value={response}
                onChange={e => { setResponse(e.target.value); if (selected?.outputFormatHint?.includes('json')) validateJson(e.target.value); }}
                className={`form-control mono ${jsonError ? 'border-danger' : ''}`} rows={6}
                placeholder="Paste the AI model's response here…"
                disabled={!selected || attemptsLeft === 0} />
            </div>

            {result && (
              <div className={`arena-result ${result.status}`}>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span style={{ fontWeight: 700 }}>
                    {result.status === 'valid' ? '✅ Valid' : result.status === 'invalid' ? '❌ Invalid' : '⚠️ Error'}
                  </span>
                  {result.score > 0 && <span className="text-accent mono" style={{ fontWeight: 700 }}>+{result.score} pts</span>}
                </div>
                <div style={{ fontSize: '.85rem', color: '#cbd5e1' }}>{result.message}</div>
                {result.validationNotes && <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '.4rem' }}>{result.validationNotes}</div>}
                {result.confidence !== undefined && (
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.4rem' }}>
                    Confidence: {(result.confidence * 100).toFixed(0)}% | Hallucination: {((result.hallucinationScore ?? 0) * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            )}

            <div className="d-flex gap-2">
              <button className="btn btn-arena-team flex-1" onClick={handleSubmit}
                disabled={!selected || !prompt.trim() || submitting || attemptsLeft === 0}>
                {submitting ? <><span className="arena-spinner me-2" />Submitting…</> : <><i className="bi bi-send-fill me-2" />Submit</>}
              </button>
              <button className="btn btn-arena-sm" onClick={handleSandbox}
                disabled={!selected || !prompt.trim() || sandboxing} title="Test without using an attempt">
                {sandboxing ? <span className="arena-spinner" /> : <><i className="bi bi-play me-1" />Test</>}
              </button>
            </div>
            {selected && attemptsLeft === 0 && (
              <div className="arena-alert arena-alert-err" style={{ fontSize: '.82rem' }}>
                <i className="bi bi-lock-fill me-1" />No attempts remaining for this mission.
              </div>
            )}
          </div>
        </div>
      </div>
    </TeamLayout>
  );
}
