// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Socket.IO Event Handlers — Real-time admin & team namespaces
// ==============================================================================

let ioInstance = null;

function initSockets(io) {
  ioInstance = io;

  // ==============================================================================
  // ADMIN NAMESPACE — /admin
  // ==============================================================================
  const adminNs = io.of('/admin');

  adminNs.on('connection', (socket) => {
    const req = socket.request;
    const user = req.session?.passport?.user ? req.user : null;

    // Authenticate on connection
    if (!socket.request.session || !socket.request.session.passport) {
      console.warn('Unauthorized admin socket connection attempt');
      socket.disconnect(true);
      return;
    }

    socket.join('admin_room');
    console.log('Admin socket connected:', socket.id);
    socket.emit('connected', { status: 'ok' });

    socket.on('request_stats', () => {
      socket.emit('stats_update', { status: 'use_rest_api' });
    });

    socket.on('disconnect', () => {
      console.log('Admin socket disconnected:', socket.id);
    });
  });

  // ==============================================================================
  // TEAM NAMESPACE — /team
  // ==============================================================================
  const teamNs = io.of('/team');

  teamNs.on('connection', (socket) => {
    if (!socket.request.session || !socket.request.session.passport) {
      socket.disconnect(true);
      return;
    }

    const userId = socket.request.session.passport.user;
    socket.join(`team_${userId}`);
    console.log('Team socket connected:', socket.id);
    socket.emit('connected', { status: 'ok' });

    socket.on('disconnect', () => {
      console.log('Team socket disconnected:', socket.id);
    });
  });

  // ==============================================================================
  // PUBLIC NAMESPACE — /public  (live scoreboard for any viewer)
  // ==============================================================================
  const publicNs = io.of('/public');

  publicNs.on('connection', (socket) => {
    socket.join('public_room');
    socket.emit('connected', { status: 'ok' });
    socket.on('disconnect', () => {});
  });

  return io;
}

// ==============================================================================
// BROADCAST HELPERS
// ==============================================================================
function broadcastLeaderboardUpdate(data) {
  if (ioInstance) {
    try {
      ioInstance.of('/admin').to('admin_room').emit('leaderboard_update', data);
      ioInstance.of('/public').to('public_room').emit('leaderboard_update', data);
    } catch (err) {
      console.error('Broadcast leaderboard error:', err);
    }
  }
}

function broadcastSubmissionEvent(data) {
  if (ioInstance) {
    try {
      ioInstance.of('/admin').to('admin_room').emit('new_submission', data);
    } catch (err) {
      console.error('Broadcast submission error:', err);
    }
  }
}

function broadcastLiveScores(teams) {
  if (ioInstance) {
    try {
      const payload = { teams, updatedAt: new Date().toISOString() };
      ioInstance.of('/admin').to('admin_room').emit('live_scores_update', payload);
      ioInstance.of('/public').to('public_room').emit('live_scores_update', payload);
    } catch (err) {
      console.error('Broadcast live scores error:', err);
    }
  }
}

module.exports = { initSockets, broadcastLeaderboardUpdate, broadcastSubmissionEvent, broadcastLiveScores };
