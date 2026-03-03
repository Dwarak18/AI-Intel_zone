// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Game Timer Engine
// Manages a single shared competition countdown. Admin controls it; both admin
// and team sockets receive real-time tick events.
// ==============================================================================

let _io = null; // Set once via setIO() after Socket.IO initialises

// Timer state
const state = {
  status: 'idle',     // 'idle' | 'running' | 'paused' | 'finished'
  totalSeconds: 3600, // default 60 min
  remainingSeconds: 3600,
  startedAt: null,    // Date when last started/resumed
  pausedAt: null,     // Date when last paused
  _intervalId: null,
};

function setIO(io) {
  _io = io;
}

function _broadcast() {
  if (!_io) return;
  const payload = getState();
  _io.of('/admin').emit('timer_tick', payload);
  _io.of('/team').emit('timer_tick', payload);
  _io.of('/public').emit('timer_tick', payload); // public leaderboard if present
}

function getState() {
  return {
    status: state.status,
    totalSeconds: state.totalSeconds,
    remainingSeconds: state.remainingSeconds,
    startedAt: state.startedAt ? state.startedAt.toISOString() : null,
    pausedAt: state.pausedAt ? state.pausedAt.toISOString() : null,
  };
}

function _stopInterval() {
  if (state._intervalId) {
    clearInterval(state._intervalId);
    state._intervalId = null;
  }
}

function _startInterval() {
  _stopInterval();
  state._intervalId = setInterval(() => {
    if (state.status !== 'running') { _stopInterval(); return; }
    if (state.remainingSeconds <= 0) {
      state.remainingSeconds = 0;
      state.status = 'finished';
      _stopInterval();
      _broadcast();
      return;
    }
    state.remainingSeconds -= 1;
    _broadcast();
  }, 1000);
}

// ==============================================================================
// Controls
// ==============================================================================

function start(totalSeconds) {
  _stopInterval();
  state.totalSeconds = Math.max(1, Math.round(totalSeconds));
  state.remainingSeconds = state.totalSeconds;
  state.status = 'running';
  state.startedAt = new Date();
  state.pausedAt = null;
  _startInterval();
  _broadcast();
  return getState();
}

function pause() {
  if (state.status !== 'running') return getState();
  _stopInterval();
  state.status = 'paused';
  state.pausedAt = new Date();
  _broadcast();
  return getState();
}

function resume() {
  if (state.status !== 'paused') return getState();
  state.status = 'running';
  state.pausedAt = null;
  _startInterval();
  _broadcast();
  return getState();
}

function reset() {
  _stopInterval();
  state.status = 'idle';
  state.remainingSeconds = state.totalSeconds;
  state.startedAt = null;
  state.pausedAt = null;
  _broadcast();
  return getState();
}

// Adjust remaining time on-the-fly (positive = add seconds, negative = subtract)
function adjust(deltaSeconds) {
  state.remainingSeconds = Math.max(0, Math.min(state.totalSeconds, state.remainingSeconds + Math.round(deltaSeconds)));
  if (state.remainingSeconds === 0 && state.status === 'running') {
    state.status = 'finished';
    _stopInterval();
  }
  _broadcast();
  return getState();
}

// Set the total duration without resetting the running timer (clamps remaining)
function setDuration(totalSeconds) {
  state.totalSeconds = Math.max(1, Math.round(totalSeconds));
  state.remainingSeconds = Math.min(state.remainingSeconds, state.totalSeconds);
  _broadcast();
  return getState();
}

module.exports = { setIO, getState, start, pause, resume, reset, adjust, setDuration };
