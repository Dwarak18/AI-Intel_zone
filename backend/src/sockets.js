// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Socket.IO Event Handlers — Real-time admin & team namespaces
// ==============================================================================

const jwt = require('jsonwebtoken');
const config = require('./config');
const { User, TeamMember } = require('./models');

let ioInstance = null;

// Middleware: verify JWT from socket handshake auth
async function verifySocketToken(socket, next) {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecretKey);
      const user = await User.findByPk(payload.user_id);
      if (user && user.isActive) {
        socket._jwtUser = user;
        return next();
      }
    } catch {
      // Fall through to session check
    }
  }
  // Fallback: session-based auth (EJS portal)
  if (socket.request.session?.passport?.user) {
    return next();
  }
  next(new Error('Authentication required'));
}

function initSockets(io) {
  ioInstance = io;

  // ==============================================================================
  // ADMIN NAMESPACE — /admin
  // ==============================================================================
  const adminNs = io.of('/admin');

  adminNs.use(verifySocketToken);

  adminNs.on('connection', (socket) => {
    // Verify admin role
    const user = socket._jwtUser;
    if (user && !user.isAdmin) {
      socket.disconnect(true);
      return;
    }

    socket.join('admin_room');
    console.log('Admin socket connected (JWT):', socket.id);
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

  teamNs.use(verifySocketToken);

  teamNs.on('connection', async (socket) => {
    const user = socket._jwtUser;
    if (!user) { socket.disconnect(true); return; }

    // Find team membership
    try {
      const membership = await TeamMember.findOne({ where: { userId: user.id, isActive: true } });
      if (membership) {
        socket.join(`team_${membership.teamId}`);
        socket._teamId = membership.teamId;
      }
    } catch {}

    socket.join(`user_${user.id}`);
    console.log('Team socket connected (JWT):', socket.id);
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

function broadcastTeamUpdate(teamId, data) {
  if (ioInstance) {
    try {
      ioInstance.of('/team').to(`team_${teamId}`).emit('score_update', data);
    } catch (err) {
      console.error('Broadcast team update error:', err);
    }
  }
}

module.exports = { initSockets, broadcastLeaderboardUpdate, broadcastSubmissionEvent, broadcastLiveScores, broadcastTeamUpdate };
