// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Authentication Routes — Login, Register, JWT Token Management
// ==============================================================================

const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { User, Team, TeamMember } = require('../models');
const { AuditLogger } = require('../security');
const { requireLogin, generateToken } = require('../authMiddleware');
const config = require('../config');
const crypto = require('crypto');

// ==============================================================================
// ADMIN LOGIN (Session-Based)
// ==============================================================================
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.isAdmin) return res.redirect('/admin/');
    return res.redirect('/team/console');
  }
  const csrfToken = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = csrfToken;
  res.render('auth/login', {
    layout: false,
    title: 'Admin Login',
    csrfToken,
    error: req.flash('error'),
    success: req.flash('success'),
  });
});

router.post('/login', async (req, res, next) => {
  const { username, password } = req.body;

  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      await AuditLogger.log('login_failed', `Failed login attempt for: ${username}`, {
        ipAddress: req.ip,
        severity: 'warning',
      });
      req.flash('error', info?.message || 'Invalid credentials or account disabled.');
      return res.redirect('/auth/login');
    }

    // Check admin access
    if (!user.isAdmin) {
      await AuditLogger.log('login_failed', `Non-admin login attempt: ${username}`, {
        severity: 'warning', ipAddress: req.ip,
      });
      req.flash('error', 'Access denied. Admin privileges required.');
      return res.redirect('/auth/login');
    }

    req.login(user, async (loginErr) => {
      if (loginErr) return next(loginErr);

      user.lastLogin = new Date();
      user.lastLoginIp = req.ip;
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();

      await AuditLogger.log('login_success', `Admin login: ${username}`, {
        userId: user.id, ipAddress: req.ip,
      });

      req.flash('success', `Welcome back, ${user.username}!`);
      const returnTo = req.session.returnTo || '/admin/';
      delete req.session.returnTo;
      return res.redirect(returnTo);
    });
  })(req, res, next);
});

// ==============================================================================
// TEAM LOGIN (Session-Based)
// ==============================================================================
router.get('/team-login', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.isAdmin) return res.redirect('/admin/');
    return res.redirect('/team/console');
  }
  const csrfToken = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = csrfToken;
  res.render('auth/team_login', {
    layout: false,
    title: 'Team Login',
    csrfToken,
    error: req.flash('error'),
    success: req.flash('success'),
  });
});

router.post('/team-login', async (req, res, next) => {
  const { username, password } = req.body;

  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      await AuditLogger.log('team_login_failed', `Failed team login attempt for: ${username}`, {
        severity: 'warning', ipAddress: req.ip,
      });
      req.flash('error', info?.message || 'Invalid credentials or account disabled.');
      return res.redirect('/auth/team-login');
    }

    if (!['team_member', 'team_lead'].includes(user.role)) {
      await AuditLogger.log('team_login_failed', `Non-team account attempted team login: ${username}`, {
        severity: 'warning', ipAddress: req.ip,
      });
      req.flash('error', 'Use admin login for this account.');
      return res.redirect('/auth/team-login');
    }

    req.login(user, async (loginErr) => {
      if (loginErr) return next(loginErr);

      user.lastLogin = new Date();
      user.lastLoginIp = req.ip;
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();

      await AuditLogger.log('team_login_success', `Team login: ${username}`, {
        userId: user.id, ipAddress: req.ip,
      });

      req.flash('success', `Welcome, ${user.username}!`);
      return res.redirect('/team/console');
    });
  })(req, res, next);
});

// ==============================================================================
// LOGOUT
// ==============================================================================
router.get('/logout', requireLogin, async (req, res) => {
  const isAdminUser = req.user?.isAdmin;
  await AuditLogger.log('logout', `User logged out: ${req.user?.username}`, {
    userId: req.user?.id,
  });
  req.logout(() => {
    req.session.destroy();
    if (isAdminUser) return res.redirect('/auth/login');
    return res.redirect('/auth/team-login');
  });
});

// ==============================================================================
// API: JWT TOKEN ISSUE
// ==============================================================================
router.post('/api/token', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const user = await User.findOne({ where: { username } });
  if (!user || !(await user.checkPassword(password)) || !user.isActive) {
    await AuditLogger.log('token_request_failed', `Failed token request for: ${username}`, {
      severity: 'warning', ipAddress: req.ip,
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);
  user.lastLogin = new Date();
  user.lastLoginIp = req.ip;
  user.loginCount = (user.loginCount || 0) + 1;
  await user.save();

  await AuditLogger.log('token_issued', `JWT token issued for: ${username}`, { userId: user.id });

  return res.json({
    token,
    expiresIn: config.jwtExpiryHours * 3600,
    user: user.toDict(),
  });
});

// ==============================================================================
// API: JWT TOKEN VERIFY
// ==============================================================================
router.post('/api/token/verify', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'Missing bearer token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecretKey);
    const user = await User.findByPk(payload.user_id);
    if (!user || !user.isActive) {
      return res.status(401).json({ valid: false, error: 'User not found or disabled' });
    }
    return res.json({ valid: true, user: user.toDict() });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ valid: false, error: 'Token expired' });
    }
    return res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// ==============================================================================
// API: JWT TEAM TOKEN — login with team_code + loginPassword
// ==============================================================================
router.post('/api/team-token', async (req, res) => {
  const { team_code, password } = req.body || {};
  if (!team_code || !password) {
    return res.status(400).json({ error: 'team_code and password required' });
  }

  const team = await Team.findOne({ where: { teamCode: team_code.trim().toUpperCase() } });
  if (!team) {
    return res.status(401).json({ error: 'Invalid team code or password' });
  }

  const loginPassword = team.loginPassword || '';
  if (!loginPassword || password !== loginPassword) {
    await AuditLogger.log('team_token_failed', `Failed team token request for: ${team_code}`, {
      severity: 'warning', ipAddress: req.ip,
    });
    return res.status(401).json({ error: 'Invalid team code or password' });
  }

  if (team.status === 'locked') {
    return res.status(403).json({ error: 'Team account is locked' });
  }
  if (team.status === 'disqualified') {
    return res.status(403).json({ error: 'Team has been disqualified' });
  }

  // Find the first active team member's User account to issue a real JWT
  const membership = await TeamMember.findOne({
    where: { teamId: team.id },
    include: [{ model: User, as: 'user' }],
  });

  if (!membership || !membership.user || !membership.user.isActive) {
    return res.status(403).json({ error: 'No active user account linked to this team' });
  }

  const user = membership.user;
  const token = generateToken(user);

  await AuditLogger.log('team_token_issued', `JWT team token issued for: ${team_code}`, {
    userId: user.id, teamId: team.id,
  });

  return res.json({
    token,
    expiresIn: config.jwtExpiryHours * 3600,
    user: user.toDict(),
    team: {
      id: team.id, teamCode: team.teamCode, name: team.name,
      institution: team.institution, status: team.status,
    },
  });
});

// ==============================================================================
// TEAM SESSION LOGIN — accepts team_code + loginPassword, creates a full session
// Used by the Vercel static frontend (cross-origin form POST)
// ==============================================================================
router.post('/team-session', async (req, res) => {
  const { team_code, password } = req.body || {};
  if (!team_code || !password) {
    req.flash('error', 'Team code and password are required.');
    return res.redirect('/auth/team-login');
  }

  try {
    const team = await Team.findOne({ where: { teamCode: team_code.trim().toUpperCase() } });
    if (!team) {
      req.flash('error', 'Invalid team code or password.');
      return res.redirect('/auth/team-login');
    }

    const loginPassword = team.loginPassword || '';
    if (!loginPassword || password !== loginPassword) {
      await AuditLogger.log('team_login_failed', `Bad team-session password for: ${team_code}`, {
        severity: 'warning', ipAddress: req.ip,
      });
      req.flash('error', 'Invalid team code or password.');
      return res.redirect('/auth/team-login');
    }

    if (team.status === 'locked') {
      req.flash('error', 'Team account is locked. Contact an administrator.');
      return res.redirect('/auth/team-login');
    }
    if (team.status === 'disqualified') {
      req.flash('error', 'This team has been disqualified.');
      return res.redirect('/auth/team-login');
    }

    // Find first active team member user to log in as
    const membership = await TeamMember.findOne({
      where: { teamId: team.id, isActive: true },
      include: [{ model: User, as: 'user' }],
    });

    if (!membership || !membership.user || !membership.user.isActive) {
      req.flash('error', 'No active user account linked to this team. Contact an administrator.');
      return res.redirect('/auth/team-login');
    }

    const user = membership.user;
    req.login(user, async (err) => {
      if (err) {
        req.flash('error', 'Login error. Please try again.');
        return res.redirect('/auth/team-login');
      }

      user.lastLogin = new Date();
      user.lastLoginIp = req.ip;
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();

      await AuditLogger.log('team_login_success', `Team session login: ${team_code}`, {
        userId: user.id, teamId: team.id, ipAddress: req.ip,
      });

      return res.redirect('/team/console');
    });
  } catch (err) {
    console.error('team-session error:', err);
    req.flash('error', 'Server error. Please try again.');
    return res.redirect('/auth/team-login');
  }
});

module.exports = router;
