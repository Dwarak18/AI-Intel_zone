// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Authentication Middleware — Passport + JWT
// ==============================================================================

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const jwt = require('jsonwebtoken');
const { User } = require('./models');
const config = require('./config');

// ==============================================================================
// PASSPORT LOCAL STRATEGY (session-based, admin panel)
// ==============================================================================
passport.use(new LocalStrategy(
  { usernameField: 'username', passwordField: 'password' },
  async (username, password, done) => {
    try {
      const user = await User.findOne({ where: { username } });
      if (!user) return done(null, false, { message: 'Invalid credentials or account disabled.' });
      if (!user.isActive) return done(null, false, { message: 'Account is disabled.' });

      const match = await user.checkPassword(password);
      if (!match) return done(null, false, { message: 'Invalid credentials or account disabled.' });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// ==============================================================================
// SESSION AUTH MIDDLEWARE
// ==============================================================================
function requireLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login');
}

function requireTeamLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/team-login');
}

// ==============================================================================
// JWT AUTH MIDDLEWARE (API routes)
// ==============================================================================
async function jwtRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';

  // Session-auth fallback for web portal routes
  if (!authHeader.startsWith('Bearer ')) {
    if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.isActive) {
      // CSRF only relevant for state-changing methods
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const csrfToken = req.headers['x-csrftoken'] ||
                          req.headers['x-csrf-token'] ||
                          req.body?.csrf_token;
        if (!csrfToken || csrfToken !== req.session.csrfToken) {
          return res.status(403).json({
            error: 'CSRF token required for session-authenticated API requests.',
            hint: 'Send the token in the X-CSRFToken request header.',
          });
        }
      }
      return next();
    }
    return res.status(401).json({ error: 'Authorization header with Bearer token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecretKey);
    const user = await User.findByPk(payload.user_id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User account not found or disabled' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Generate JWT token
function generateToken(user) {
  const payload = {
    user_id: user.id,
    username: user.username,
    role: user.role,
  };
  return jwt.sign(payload, config.jwtSecretKey, {
    expiresIn: `${config.jwtExpiryHours}h`,
  });
}

module.exports = {
  passport,
  requireLogin,
  requireTeamLogin,
  jwtRequired,
  generateToken,
};
