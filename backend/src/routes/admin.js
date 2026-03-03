// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Admin Routes — Dashboard, Team Mgmt, Monitoring, Logs
// ==============================================================================

const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const { sequelize, User, Team, TeamMember, Mission, Submission,
        AILog, AuditLog, SecurityEvent, Achievement, ScoreOverride } = require('../models');
const { requireAdmin, AuditLogger } = require('../security');
const { requireLogin, jwtRequired } = require('../authMiddleware');
const ScoringEngine = require('../scoringEngine');
const TimerEngine = require('../timerEngine');

// Optional dependencies — fail gracefully if not installed
let multer = null;
let ExcelJS = null;
try { multer = require('multer'); } catch (_) {}
try { ExcelJS = require('exceljs'); } catch (_) {}

const auth = [requireLogin, requireAdmin];
// API auth: accepts JWT Bearer token OR existing session — for React frontend
const apiAuth = [jwtRequired, requireAdmin];

// ==============================================================================
// SPA PASSTHROUGH
// When the React build is present (/app/public/index.html), skip all non-API
// routes so the SPA catch-all in app.js can serve index.html.
// This prevents EJS routes like /admin/teams from intercepting React nav links.
// ==============================================================================
const _spaIndex = require('path').join(__dirname, '../../public/index.html');
router.use((req, res, next) => {
  // Always let /api/* through (JSON endpoints used by the React app)
  if (req.path.startsWith('/api')) return next();
  // If React build exists, hand off non-API paths to the SPA catch-all
  if (require('fs').existsSync(_spaIndex)) return next('router');
  // No React build (dev/legacy mode) — fall through to EJS routes
  return next();
});

// ==============================================================================
// DASHBOARD
// ==============================================================================
router.get('/', ...auth, async (req, res) => {
  try {
    const totalTeams = await Team.count();
    const activeTeams = await Team.count({ where: { status: 'active' } });
    const lockedTeams = await Team.count({ where: { status: 'locked' } });
    const disqualifiedTeams = await Team.count({ where: { status: 'disqualified' } });

    const totalSubmissions = await Submission.count();
    const validSubmissions = await Submission.count({ where: { validationStatus: 'valid' } });
    const invalidSubmissions = await Submission.count({ where: { validationStatus: 'invalid' } });
    const errorSubmissions = await Submission.count({ where: { validationStatus: 'error' } });

    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentSubmissions = await Submission.count({
      where: { createdAt: { [Op.gte]: oneHourAgo } },
    });

    const openSecurityEvents = await SecurityEvent.count({ where: { status: 'open' } });
    const flaggedSubmissions = await Submission.count({ where: { isFlagged: true } });

    const topTeams = await Team.findAll({
      where: { status: 'active' },
      order: [[literal('current_rank IS NULL'), 'ASC'], ['currentRank', 'ASC']],
      limit: 10,
    });

    const recentSubs = await Submission.findAll({
      include: [{ model: Mission, as: 'mission' }, { model: Team, as: 'team' }],
      order: [['createdAt', 'DESC']],
      limit: 15,
    });

    const validationRate = totalSubmissions > 0 ? (validSubmissions / totalSubmissions * 100) : 0;

    res.render('admin/dashboard', {
      title: 'Dashboard',
      totalTeams, activeTeams, lockedTeams, disqualifiedTeams,
      totalSubmissions, validSubmissions, invalidSubmissions, errorSubmissions,
      recentSubmissions, validationRate: Math.round(validationRate * 10) / 10,
      openSecurityEvents, flaggedSubmissions, topTeams, recentSubs,
      flash: { success: req.flash('success'), error: req.flash('error'), warning: req.flash('warning') },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Dashboard failed to load' });
  }
});

// ==============================================================================
// TEAM MANAGEMENT
// ==============================================================================
router.get('/teams', ...auth, async (req, res) => {
  try {
    const { status: statusFilter = 'all', search = '' } = req.query;
    const where = {};
    if (statusFilter !== 'all') where.status = statusFilter;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { teamCode: { [Op.like]: `%${search}%` } },
      ];
    }

    const teams = await Team.findAll({
      where,
      include: [{ model: TeamMember, as: 'members', include: [{ model: User, as: 'user' }] }],
      order: [['createdAt', 'DESC']],
    });

    res.render('admin/teams', {
      title: 'Team Management',
      teams, statusFilter, search,
      flash: { success: req.flash('success'), error: req.flash('error'), warning: req.flash('warning') },
    });
  } catch (err) {
    console.error('Teams error:', err);
    res.status(500).json({ error: 'Teams page failed to load' });
  }
});

router.post('/teams/create', ...auth, async (req, res) => {
  const { team_code, name, institution } = req.body;
  const teamCode = (team_code || '').trim().toUpperCase();
  const teamName = (name || '').trim();

  if (!teamCode || !teamName) {
    req.flash('error', 'Team code and name are required.');
    return res.redirect('/admin/teams');
  }

  const existing = await Team.findOne({ where: { teamCode } });
  if (existing) {
    req.flash('error', `Team code '${teamCode}' already exists.`);
    return res.redirect('/admin/teams');
  }

  const rawPassword = (req.body.login_password || '').trim();
  const team = await Team.create({
    teamCode, name: teamName,
    institution: institution?.trim() || '',
    loginPassword: rawPassword || null,
    status: 'active',
  });
  await AuditLogger.log('team_created', `Team created: ${teamCode} - ${teamName}`, {
    userId: req.user.id, resourceType: 'team', resourceId: team.id,
  });

  req.flash('success', `Team '${teamName}' (${teamCode}) created successfully!`);
  return res.redirect('/admin/teams');
});

router.post('/teams/:teamId/add_member', ...auth, async (req, res) => {
  const { teamId } = req.params;
  const { username, email, password, role_in_team = 'member' } = req.body;
  const team = await Team.findByPk(teamId);
  if (!team) { req.flash('error', 'Team not found.'); return res.redirect('/admin/teams'); }

  if (!username || !email || !password) {
    req.flash('error', 'Username, email, and password are required.');
    return res.redirect('/admin/teams');
  }

  let user = await User.findOne({ where: { username } });
  if (!user) {
    user = User.build({ username, email, role: 'team_member' });
    await user.setPassword(password);
    await user.save();
  }

  const existingMember = await TeamMember.findOne({ where: { teamId, userId: user.id } });
  if (existingMember) {
    req.flash('warning', `User '${username}' is already a member of this team.`);
    return res.redirect('/admin/teams');
  }

  const member = await TeamMember.create({ teamId, userId: user.id, roleInTeam: role_in_team });
  await AuditLogger.log('member_added', `Member ${username} added to team ${team.teamCode}`, {
    userId: req.user.id, resourceType: 'team_member', resourceId: member.id, teamId,
  });

  req.flash('success', `Member '${username}' added to team '${team.name}'.`);
  return res.redirect('/admin/teams');
});

router.post('/teams/:teamId/lock', ...auth, async (req, res) => {
  const team = await Team.findByPk(req.params.teamId);
  if (!team) { req.flash('error', 'Team not found.'); return res.redirect('/admin/teams'); }

  let action, msg;
  if (team.status === 'locked') {
    team.status = 'active'; action = 'team_unlocked'; msg = `Team '${team.name}' has been unlocked.`;
  } else {
    team.status = 'locked'; action = 'team_locked'; msg = `Team '${team.name}' has been locked.`;
  }
  await team.save();

  await AuditLogger.log(action, msg, { userId: req.user.id, teamId: team.id, severity: 'warning' });
  req.flash('warning', msg);
  return res.redirect('/admin/teams');
});

router.post('/teams/:teamId/disqualify', ...auth, async (req, res) => {
  const team = await Team.findByPk(req.params.teamId);
  if (!team) { req.flash('error', 'Team not found.'); return res.redirect('/admin/teams'); }

  const reason = req.body.reason || 'Admin decision';
  team.status = 'disqualified';
  team.disqualificationReason = reason;
  await team.save();

  await AuditLogger.log('team_disqualified', `Team '${team.name}' disqualified. Reason: ${reason}`, {
    userId: req.user.id, teamId: team.id, severity: 'critical',
  });
  req.flash('error', `Team '${team.name}' has been disqualified.`);
  return res.redirect('/admin/teams');
});

router.post('/teams/:teamId/override', ...auth, async (req, res) => {
  const team = await Team.findByPk(req.params.teamId);
  if (!team) { req.flash('error', 'Team not found.'); return res.redirect('/admin/teams'); }

  const newScore = parseFloat(req.body.new_score || 0);
  const reason = (req.body.reason || '').trim();
  const overrideType = req.body.override_type || 'correction';

  if (!reason) {
    req.flash('error', 'A reason is required for score overrides.');
    return res.redirect('/admin/teams');
  }

  await ScoreOverride.create({
    teamId: team.id, adminId: req.user.id,
    previousScore: team.totalScore, newScore, reason, overrideType,
  });
  team.totalScore = newScore;
  await team.save();
  await ScoringEngine.recalculateRankings();

  await AuditLogger.log('score_override',
    `Score override for team '${team.name}': ${team.totalScore} → ${newScore}. Reason: ${reason}`,
    { userId: req.user.id, teamId: team.id, severity: 'critical' });

  req.flash('warning', `Score updated for '${team.name}': ${newScore}`);
  return res.redirect('/admin/teams');
});

// ==============================================================================
// LIVE SCORES
// ==============================================================================
router.get('/live-scores', ...auth, async (req, res) => {
  try {
    const { Op, literal } = require('sequelize');
    const teams = await Team.findAll({
      order: [
        [literal('current_rank IS NULL'), 'ASC'],
        ['currentRank', 'ASC'],
        ['totalScore', 'DESC'],
      ],
    });
    res.render('admin/live_scores', {
      title: 'Live Scores',
      teams,
      flash: { success: req.flash('success'), error: req.flash('error'), warning: req.flash('warning') },
    });
  } catch (err) {
    console.error('Live scores error:', err);
    res.status(500).json({ error: 'Live scores failed to load' });
  }
});

router.get('/api/live-scores', ...apiAuth, async (req, res) => {
  try {
    const { Op, literal } = require('sequelize');
    const teams = await Team.findAll({
      order: [
        [literal('current_rank IS NULL'), 'ASC'],
        ['currentRank', 'ASC'],
        ['totalScore', 'DESC'],
      ],
    });
    const scoreList = teams.map(t => ({
      id: t.id,
      rank: t.currentRank,
      teamCode: t.teamCode,
      name: t.name,
      institution: t.institution || '',
      loginPassword: t.loginPassword || '',
      totalScore: Math.round(t.totalScore * 100) / 100,
      bonusPoints: Math.round(t.bonusPoints * 100) / 100,
      combinedScore: Math.round((t.totalScore + t.bonusPoints) * 100) / 100,
      missionsCompleted: t.missionsCompleted,
      totalSubmissions: t.totalSubmissions,
      validationRate: t.totalSubmissions > 0
        ? Math.round(t.successfulValidations / t.totalSubmissions * 1000) / 10
        : 0,
      healthScore: Math.round(t.healthScore * 10) / 10,
      status: t.status,
      avatarColor: t.avatarColor,
      lastActivityAt: t.lastActivityAt ? t.lastActivityAt.toISOString() : null,
    }));
    return res.json({
      scores: scoreList,
      teams: scoreList,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('API live-scores error:', err);
    return res.status(500).json({ error: 'Failed to load live scores' });
  }
});

// ==============================================================================
// ACTIVITY MONITOR
// ==============================================================================
router.get('/activity', ...auth, async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 3600000);

    const recent = await Submission.findAll({
      include: [{ model: Team, as: 'team' }, { model: Mission, as: 'mission' }],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    const frequency = await Submission.findAll({
      attributes: [
        [col('team.team_code'), 'team_code'],
        [col('team.name'), 'team_name'],
        [fn('COUNT', col('Submission.id')), 'count'],
      ],
      include: [{ model: Team, as: 'team', attributes: [] }],
      where: { createdAt: { [Op.gte]: oneHourAgo } },
      group: ['team.team_code', 'team.name'],
      order: [[fn('COUNT', col('Submission.id')), 'DESC']],
      raw: true,
    });

    const flagged = await Submission.findAll({
      where: { isFlagged: true },
      include: [{ model: Team, as: 'team' }, { model: Mission, as: 'mission' }],
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    const hallucinationData = await Team.findAll({
      where: { hallucinationCount: { [Op.gt]: 0 } },
      order: [['hallucinationCount', 'DESC']],
    });

    res.render('admin/activity', {
      title: 'Activity Monitor',
      recent, frequency, flagged, hallucinationData,
      flash: { success: req.flash('success'), error: req.flash('error') },
    });
  } catch (err) {
    console.error('Activity monitor error:', err);
    res.status(500).json({ error: 'Activity monitor failed to load' });
  }
});

// ==============================================================================
// AI LOGS VIEWER
// ==============================================================================
router.get('/logs', ...auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const perPage = 25;
    const offset = (page - 1) * perPage;
    const { team_id, mission_id, status, date_from, date_to, flagged } = req.query;

    const where = {};
    if (team_id) where.teamId = team_id;
    if (status) where.validationResult = status;
    if (flagged === '1') where.injectionScore = { [Op.gt]: 0.5 };
    if (date_from) { try { where.createdAt = { ...(where.createdAt || {}), [Op.gte]: new Date(date_from) }; } catch(e) {} }
    if (date_to) {
      const endDt = new Date(date_to);
      endDt.setHours(23, 59, 59, 999);
      where.createdAt = { ...(where.createdAt || {}), [Op.lte]: endDt };
    }

    const { count, rows: logs } = await AILog.findAndCountAll({
      where,
      include: [{ model: Team, as: 'team' }],
      order: [['createdAt', 'DESC']],
      limit: perPage,
      offset,
    });

    const teams = await Team.findAll({ order: [['teamCode', 'ASC']] });
    const missions = await Mission.findAll({ where: { isActive: true }, order: [['orderIndex', 'ASC']] });

    res.render('admin/logs', {
      title: 'AI Logs',
      logs, teams, missions,
      pagination: { total: count, page, perPage, pages: Math.ceil(count / perPage) },
      filters: { team_id, mission_id, status, date_from, date_to, flagged },
      flash: { success: req.flash('success'), error: req.flash('error') },
    });
  } catch (err) {
    console.error('AI logs error:', err);
    res.status(500).json({ error: 'AI logs failed to load' });
  }
});

router.get('/api/logs/:logId', ...apiAuth, async (req, res) => {
  try {
    const log = await AILog.findByPk(req.params.logId);
    if (!log) return res.status(404).json({ error: 'Log not found' });

    const team = await Team.findByPk(log.teamId);
    let missionTitle = null;
    let missionCode = null;
    let validationNotes = null;
    if (log.submissionId) {
      try {
        const sub = await Submission.findByPk(log.submissionId, {
          include: [{ model: Mission, as: 'mission' }],
        });
        missionTitle = sub?.mission?.title || null;
        missionCode = sub?.mission?.missionCode || null;
        if (sub?.validationErrors) {
          try { validationNotes = JSON.parse(sub.validationErrors).join('\n'); } catch (_) {}
        }
      } catch (_) {}
    }

    const valResult = log.validationResult || '';
    const statusMapped = valResult === 'pass' ? 'valid' : valResult === 'fail' ? 'invalid' : (valResult || 'error');
    const isFlagged = log.rejected || (log.injectionScore || 0) > 0.5;
    const errDetails = (log.errorDetails || '').substring(0, 10000);

    return res.json({
      id: log.id,
      teamCode: team?.teamCode || 'N/A',
      missionCode: missionCode || '',
      missionTitle: missionTitle || '',
      createdAt: log.createdAt?.toISOString() || null,
      promptText: (log.promptText || '').substring(0, 10000),
      responseText: (log.aiRawOutput || '').substring(0, 20000),
      aiRawOutput: (log.aiRawOutput || '').substring(0, 20000),
      aiParsedOutput: (log.aiParsedOutput || '').substring(0, 15000),
      validationNotes: validationNotes || errDetails || null,
      parseResult: log.parseResult,
      validationResult: valResult,
      status: statusMapped,
      confidenceScore: log.confidenceScore || 0,
      hallucinationScore: log.hallucinationProbability || 0,
      hallucinationProbability: log.hallucinationProbability || 0,
      injectionScore: log.injectionScore || 0,
      flagged: isFlagged,
      rejected: log.rejected,
      rejectionReason: log.rejectionReason,
      errorDetails: errDetails,
      retryAttempt: log.retryAttempt,
      ipAddress: log.ipAddress,
    });
  } catch (err) {
    console.error('api_log_detail error:', err);
    return res.status(500).json({ error: 'Failed to load log detail' });
  }
});

// ==============================================================================
// LEADERBOARD MANAGEMENT
// ==============================================================================
router.get('/leaderboard', ...auth, async (req, res) => {
  try {
    const teams = await Team.findAll({
      where: { status: { [Op.in]: ['active', 'locked'] } },
      order: [[literal('current_rank IS NULL'), 'ASC'], ['currentRank', 'ASC']],
    });
    res.render('admin/leaderboard', {
      title: 'Leaderboard',
      teams,
      flash: { success: req.flash('success'), error: req.flash('error') },
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Leaderboard failed to load' });
  }
});

router.post('/leaderboard/recalculate', ...auth, async (req, res) => {
  const rankings = await ScoringEngine.recalculateRankings();
  await AuditLogger.log('leaderboard_recalculated',
    `Admin forced leaderboard recalculation. ${rankings.length} teams ranked.`,
    { userId: req.user.id });
  req.flash('success', `Leaderboard recalculated. ${rankings.length} teams ranked.`);
  return res.redirect('/admin/leaderboard');
});

// ==============================================================================
// SECURITY EVENTS
// ==============================================================================
router.get('/security', ...auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const perPage = 25;
    const { severity, status } = req.query;
    const where = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;

    const { count, rows: events } = await SecurityEvent.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: perPage,
      offset: (page - 1) * perPage,
    });

    const totalEvents = await SecurityEvent.count();
    const criticalEvents = await SecurityEvent.count({ where: { severity: 'critical' } });
    const openEvents = await SecurityEvent.count({ where: { status: 'open' } });

    res.render('admin/security', {
      title: 'Security Events',
      events, totalEvents, criticalEvents, openEvents,
      pagination: { total: count, page, perPage, pages: Math.ceil(count / perPage) },
      filters: { severity, status },
      flash: { success: req.flash('success'), error: req.flash('error') },
    });
  } catch (err) {
    console.error('Security page error:', err);
    res.status(500).json({ error: 'Security page failed to load' });
  }
});

router.post('/security/:eventId/resolve', ...auth, async (req, res) => {
  const event = await SecurityEvent.findByPk(req.params.eventId);
  if (!event) { req.flash('error', 'Event not found.'); return res.redirect('/admin/security'); }

  event.status = req.body.status || 'resolved';
  event.resolvedBy = req.user.id;
  event.resolvedAt = new Date();
  event.resolutionNotes = req.body.notes || '';
  await event.save();

  await AuditLogger.log('security_event_resolved',
    `Security event ${event.id} resolved as ${event.status}`, { userId: req.user.id });
  req.flash('success', 'Security event updated.');
  return res.redirect('/admin/security');
});

// ==============================================================================
// AUDIT TRAIL
// ==============================================================================
router.get('/audit', ...auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const perPage = 50;
    const { action: actionFilter, severity: severityFilter } = req.query;
    const where = {};
    if (actionFilter) where.action = actionFilter;
    if (severityFilter) where.severity = severityFilter;

    const { count, rows: logs } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: perPage,
      offset: (page - 1) * perPage,
    });

    const actionList = (await AuditLog.findAll({
      attributes: [[fn('DISTINCT', col('action')), 'action']],
      raw: true,
    })).map(r => r.action);

    res.render('admin/audit', {
      title: 'Audit Trail',
      logs, actionList,
      pagination: { total: count, page, perPage, pages: Math.ceil(count / perPage) },
      filters: { actionFilter, severityFilter },
      flash: { success: req.flash('success'), error: req.flash('error') },
    });
  } catch (err) {
    console.error('Audit trail error:', err);
    res.status(500).json({ error: 'Audit trail failed to load' });
  }
});

router.post('/audit/export', ...auth, async (req, res) => {
  const logs = await AuditLog.findAll({ order: [['createdAt', 'DESC']] });
  const data = JSON.stringify(logs.map(l => l.toDict()), null, 2);
  await AuditLogger.log('audit_export', `Audit logs exported (${logs.length} records)`, {
    userId: req.user.id, severity: 'warning',
  });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment;filename=audit_log_export.json');
  return res.send(data);
});

// ==============================================================================
// MISSION MANAGEMENT
// ==============================================================================
router.get('/missions', ...auth, async (req, res) => {
  try {
    const missions = await Mission.findAll({ order: [['orderIndex', 'ASC']] });
    res.render('admin/missions', {
      title: 'Missions',
      missions,
      flash: { success: req.flash('success'), error: req.flash('error') },
    });
  } catch (err) {
    console.error('Missions error:', err);
    res.status(500).json({ error: 'Missions page failed to load' });
  }
});

router.post('/missions/create', ...auth, async (req, res) => {
  const {
    mission_code, title, description, difficulty, category,
    max_points, time_limit, max_retries, expected_schema,
    expected_fields, validation_regex, sample_response,
    is_visible, order_index,
  } = req.body;

  const mission = await Mission.create({
    missionCode: (mission_code || '').trim().toUpperCase(),
    title: (title || '').trim(),
    description: (description || '').trim(),
    difficulty: difficulty || 'medium',
    category: (category || '').trim(),
    maxPoints: parseFloat(max_points || 100),
    timeLimitSeconds: parseInt(time_limit || 600),
    maxRetries: parseInt(max_retries || 20),
    expectedSchema: expected_schema || '',
    expectedFields: expected_fields || '',
    validationRegex: validation_regex || '',
    sampleResponse: sample_response || '',
    isActive: true,
    isVisible: !!is_visible,
    orderIndex: parseInt(order_index || 0),
  });

  await AuditLogger.log('mission_created', `Mission created: ${mission.missionCode} - ${mission.title}`, {
    userId: req.user.id, resourceType: 'mission', resourceId: mission.id,
  });
  req.flash('success', `Mission '${mission.title}' created!`);
  return res.redirect('/admin/missions');
});

router.post('/missions/:missionId/toggle', ...auth, async (req, res) => {
  const mission = await Mission.findByPk(req.params.missionId);
  if (!mission) { req.flash('error', 'Mission not found.'); return res.redirect('/admin/missions'); }

  mission.isVisible = !mission.isVisible;
  await mission.save();

  const status = mission.isVisible ? 'visible' : 'hidden';
  await AuditLogger.log('mission_toggled', `Mission ${mission.missionCode} set to ${status}`, {
    userId: req.user.id, resourceType: 'mission', resourceId: mission.id,
  });
  req.flash('success', `Mission '${mission.title}' is now ${status}.`);
  return res.redirect('/admin/missions');
});

// ==============================================================================
// AJAX STATS ENDPOINTS
// ==============================================================================
router.get('/api/stats', ...apiAuth, async (req, res) => {
  try {
    const [
      totalTeams, activeTeams, lockedTeams,
      totalSubmissions, totalSuccessful,
      openSecurityEvents, flaggedLogs,
    ] = await Promise.all([
      Team.count(),
      Team.count({ where: { status: 'active' } }),
      Team.count({ where: { status: 'locked' } }),
      Submission.count(),
      Submission.count({ where: { validationStatus: 'valid' } }),
      SecurityEvent.count({ where: { status: 'open' } }),
      Submission.count({ where: { isFlagged: true } }),
    ]);

    const validationRate = totalSubmissions > 0
      ? Math.round((totalSuccessful / totalSubmissions) * 1000) / 10 : 0;

    const hallucinationTotal = (await Team.sum('hallucinationCount')) || 0;
    const hallucinationRate = totalSubmissions > 0
      ? Math.round((hallucinationTotal / totalSubmissions) * 10000) / 100 : 0;

    return res.json({
      totalTeams,
      activeTeams,
      lockedTeams,
      totalSubmissions,
      totalSuccessful,
      validationRate,
      openSecurityEvents,
      flaggedLogs,
      hallucinationRate,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('api_stats error:', err);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/api/activity_feed', ...apiAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || 20), 50);
    const recent = await Submission.findAll({
      include: [{ model: Team, as: 'team' }, { model: Mission, as: 'mission' }],
      order: [['createdAt', 'DESC']],
      limit,
    });

    const activity = recent.map(sub => ({
      id: sub.id,
      teamCode: sub.team?.teamCode || 'N/A',
      teamName: sub.team?.name || 'Unknown',
      missionCode: sub.mission?.missionCode || 'N/A',
      mission: sub.mission?.title || 'Unknown Mission',
      status: sub.validationStatus,
      score: Math.round(sub.totalScore * 100) / 100,
      attempt: sub.attemptNumber,
      promptLength: sub.promptLength || (sub.promptText ? sub.promptText.length : 0),
      flagged: sub.isFlagged,
      suspicious: !!(sub.isFlagged || sub.injectionDetected || sub.isHallucinated),
      createdAt: sub.createdAt.toISOString(),
    }));

    return res.json({ activity, feed: activity });
  } catch (err) {
    console.error('api_activity_feed error:', err);
    return res.status(500).json({ error: 'Failed to load activity feed' });
  }
});

router.get('/api/analytics', ...apiAuth, async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getTime() - 86400000);

    const recentSubs = await Submission.findAll({
      attributes: ['createdAt', 'validationStatus'],
      where: { createdAt: { [Op.gte]: start } },
      raw: true,
    });

    const buckets = {};
    for (let i = 0; i < 24; i++) {
      const bucketStart = new Date(start.getTime() + i * 3600000);
      const key = bucketStart.getUTCHours().toString().padStart(2, '0') + ':00';
      buckets[key] = { hour: key, total: 0, invalid: 0 };
    }

    for (const { createdAt, validationStatus } of recentSubs) {
      const d = new Date(createdAt);
      const hourKey = d.getUTCHours().toString().padStart(2, '0') + ':00';
      if (buckets[hourKey]) {
        buckets[hourKey].total++;
        if (['invalid', 'error'].includes(validationStatus)) buckets[hourKey].invalid++;
      }
    }

    const hallucinationTotal = (await Team.sum('hallucinationCount')) || 0;
    const subTotal = await Submission.count();
    const activeTeams = await Team.count({
      where: {
        lastActivityAt: { [Op.gte]: new Date(now.getTime() - 900000) },
        status: 'active',
      },
    });

    const activeTeamsList = await Team.findAll({
      where: { status: 'active' },
      order: [['totalScore', 'DESC']],
      limit: 20,
      attributes: ['teamCode', 'name', 'totalScore', 'totalSubmissions'],
      raw: true,
    });

    const hourlyData = Object.values(buckets);
    const hallucinationRate = Math.round((hallucinationTotal / Math.max(subTotal, 1)) * 100 * 100) / 100;

    return res.json({
      hourlyData,
      hourly: hourlyData,
      statusCounts: {
        valid: await Submission.count({ where: { validationStatus: 'valid' } }),
        invalid: await Submission.count({ where: { validationStatus: 'invalid' } }),
        error: await Submission.count({ where: { validationStatus: 'error' } }),
      },
      activeTeams15m: activeTeams,
      hallucinationRate,
      serverLoad: {
        queueDepth: await SecurityEvent.count({ where: { status: 'open' } }),
        eventsOpen: await SecurityEvent.count({ where: { status: 'open' } }),
      },
      activeTeamsList: activeTeamsList.map(t => ({
        teamCode: t.teamCode || t.team_code || '',
        name: t.name || '',
        totalScore: Math.round((t.totalScore || t.total_score || 0) * 100) / 100,
        submissionCount: t.totalSubmissions || t.total_submissions || 0,
      })),
    });
  } catch (err) {
    console.error('api_analytics error:', err);
    return res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ==============================================================================
// REACT FRONTEND JSON API ENDPOINTS
// All use apiAuth = [jwtRequired, requireAdmin] — accept JWT Bearer tokens
// ==============================================================================

// GET /admin/api/teams — list all teams with members
router.get('/api/teams', ...apiAuth, async (req, res) => {
  try {
    const { status: statusFilter = 'all', search = '' } = req.query;
    const where = {};
    if (statusFilter && statusFilter !== 'all') where.status = statusFilter;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { teamCode: { [Op.like]: `%${search}%` } },
      ];
    }
    const teams = await Team.findAll({
      where,
      include: [{ model: TeamMember, as: 'members', include: [{ model: User, as: 'user' }] }],
      order: [['createdAt', 'DESC']],
    });
    return res.json({
      teams: teams.map(t => ({
        id: t.id, teamCode: t.teamCode, name: t.name,
        institution: t.institution || '',
        loginPassword: t.loginPassword || '',
        password: t.loginPassword || '',
        status: t.status, totalScore: t.totalScore, bonusPoints: t.bonusPoints,
        currentRank: t.currentRank, missionsCompleted: t.missionsCompleted,
        totalSubmissions: t.totalSubmissions, healthScore: t.healthScore,
        hallucinationCount: t.hallucinationCount, avatarColor: t.avatarColor,
        disqualificationReason: t.disqualificationReason || '',
        lastActivityAt: t.lastActivityAt ? t.lastActivityAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        members: (t.members || []).map(m => ({
          id: m.id, roleInTeam: m.roleInTeam,
          username: m.user?.username, email: m.user?.email,
          name: m.user?.username || m.user?.email || 'member',
        })),
        // TeamsPage expects 'TeamMembers' array with {name}
        TeamMembers: (t.members || []).map(m => ({
          id: m.id, roleInTeam: m.roleInTeam,
          name: m.user?.username || m.user?.email || 'member',
          email: m.user?.email || '',
          username: m.user?.username || '',
        })),
      })),
    });
  } catch (err) {
    console.error('api/teams error:', err);
    return res.status(500).json({ error: 'Failed to load teams' });
  }
});

// POST /admin/api/teams/create — create a team (accepts camelCase or snake_case)
router.post('/api/teams/create', ...apiAuth, async (req, res) => {
  try {
    // Accept both camelCase (React) and snake_case (legacy)
    const rawCode = req.body.teamCode || req.body.team_code || '';
    const teamCode = rawCode.trim().toUpperCase();
    const teamName = (req.body.name || req.body.teamName || rawCode || '').trim() || teamCode;
    const loginPassword = (req.body.password || req.body.login_password || '').trim();
    const institution = (req.body.institution || '').trim();

    if (!teamCode) return res.status(400).json({ error: 'Team code is required' });

    const existing = await Team.findOne({ where: { teamCode } });
    if (existing) return res.status(409).json({ error: `Team code '${teamCode}' already exists` });

    const team = await Team.create({
      teamCode, name: teamName,
      institution,
      loginPassword: loginPassword || null,
      status: 'active',
    });
    await AuditLogger.log('team_created', `Team created via React: ${teamCode} - ${teamName}`, {
      userId: req.user.id, resourceType: 'team', resourceId: team.id,
    });
    return res.status(201).json({ success: true, team: { id: team.id, teamCode, name: teamName } });
  } catch (err) {
    console.error('api/teams/create error:', err);
    return res.status(500).json({ error: 'Failed to create team' });
  }
});

// POST /admin/api/teams/:teamId/add_member — add user to team
router.post('/api/teams/:teamId/add_member', ...apiAuth, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { username, email, password, role_in_team = 'member' } = req.body;
    const team = await Team.findByPk(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!username || !email || !password) return res.status(400).json({ error: 'username, email, password required' });

    let user = await User.findOne({ where: { username } });
    if (!user) {
      user = User.build({ username, email, role: 'team_member' });
      await user.setPassword(password);
      await user.save();
    }
    const existingMember = await TeamMember.findOne({ where: { teamId, userId: user.id } });
    if (existingMember) return res.status(409).json({ error: `User '${username}' already in team` });

    await TeamMember.create({ teamId, userId: user.id, roleInTeam: role_in_team });
    await AuditLogger.log('member_added', `Member ${username} added to team ${team.teamCode}`, {
      userId: req.user.id, resourceType: 'team_member', teamId,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('api/teams/add_member error:', err);
    return res.status(500).json({ error: 'Failed to add member' });
  }
});

// POST /admin/api/teams/:teamId/lock — toggle lock/active
router.post('/api/teams/:teamId/lock', ...apiAuth, async (req, res) => {
  try {
    const team = await Team.findByPk(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    team.status = team.status === 'locked' ? 'active' : 'locked';
    await team.save();
    await AuditLogger.log(team.status === 'locked' ? 'team_locked' : 'team_unlocked',
      `Team '${team.name}' status: ${team.status}`, { userId: req.user.id, teamId: team.id, severity: 'warning' });
    return res.json({ success: true, status: team.status });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update team status' });
  }
});

// POST /admin/api/teams/:teamId/disqualify — disqualify team
router.post('/api/teams/:teamId/disqualify', ...apiAuth, async (req, res) => {
  try {
    const team = await Team.findByPk(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    team.status = 'disqualified';
    team.disqualificationReason = req.body.reason || 'Admin decision';
    await team.save();
    await AuditLogger.log('team_disqualified', `Team '${team.name}' disqualified`, {
      userId: req.user.id, teamId: team.id, severity: 'critical' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to disqualify team' });
  }
});

// POST /admin/api/teams/:teamId/override — score override
router.post('/api/teams/:teamId/override', ...apiAuth, async (req, res) => {
  try {
    const team = await Team.findByPk(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const newScore = parseFloat(req.body.new_score || 0);
    const reason = (req.body.reason || '').trim();
    const overrideType = req.body.override_type || 'correction';
    if (!reason) return res.status(400).json({ error: 'Reason required for score override' });
    await ScoreOverride.create({
      teamId: team.id, adminId: req.user.id,
      previousScore: team.totalScore, newScore, reason, overrideType,
    });
    team.totalScore = newScore;
    await team.save();
    await ScoringEngine.recalculateRankings();
    await AuditLogger.log('score_override',
      `Score override for '${team.name}': ${team.totalScore} → ${newScore}. ${reason}`,
      { userId: req.user.id, teamId: team.id, severity: 'critical' });
    return res.json({ success: true, newScore });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to apply score override' });
  }
});

// GET /admin/api/missions — list all missions
router.get('/api/missions', ...apiAuth, async (req, res) => {
  try {
    const missions = await Mission.findAll({ order: [['orderIndex', 'ASC']] });
    return res.json({
      missions: missions.map(m => ({
        id: m.id, missionCode: m.missionCode, title: m.title,
        description: m.description, difficulty: m.difficulty, category: m.category,
        maxPoints: m.maxPoints, timeLimitSeconds: m.timeLimitSeconds,
        maxRetries: m.maxRetries, isActive: m.isActive, isVisible: m.isVisible,
        orderIndex: m.orderIndex,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load missions' });
  }
});

// POST /admin/api/missions/:missionId/toggle — toggle visibility
router.post('/api/missions/:missionId/toggle', ...apiAuth, async (req, res) => {
  try {
    const mission = await Mission.findByPk(req.params.missionId);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    mission.isVisible = !mission.isVisible;
    await mission.save();
    return res.json({ success: true, isVisible: mission.isVisible });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to toggle mission' });
  }
});

// GET /admin/api/logs — paginated AI logs
router.get('/api/logs', ...apiAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const perPage = 25;
    const offset = (page - 1) * perPage;
    const { team_id, status, date_from, date_to, flagged } = req.query;
    const where = {};
    if (team_id) where.teamId = team_id;
    // status filter maps to validationResult field
    if (status) {
      const valMap = { valid: 'pass', invalid: 'fail', error: 'fail' };
      where.validationResult = valMap[status] || status;
    }
    if (flagged === '1') where[Op.or] = [{ rejected: true }, { injectionScore: { [Op.gt]: 0.5 } }];
    if (date_from) { try { where.createdAt = { ...(where.createdAt || {}), [Op.gte]: new Date(date_from) }; } catch(e) {} }
    if (date_to) {
      const endDt = new Date(date_to); endDt.setHours(23, 59, 59, 999);
      where.createdAt = { ...(where.createdAt || {}), [Op.lte]: endDt };
    }
    const { count, rows: logs } = await AILog.findAndCountAll({
      where,
      include: [{ model: Team, as: 'team' }],
      order: [['createdAt', 'DESC']],
      limit: perPage, offset,
    });

    // Resolve missionCode via submissionId (batch lookup, no N+1)
    const submissionIds = logs.map(l => l.submissionId).filter(Boolean);
    let submissionMissionMap = {};
    if (submissionIds.length > 0) {
      try {
        const subs = await Submission.findAll({
          where: { id: submissionIds },
          include: [{ model: Mission, as: 'mission', attributes: ['missionCode'] }],
          attributes: ['id'],
        });
        subs.forEach(s => { submissionMissionMap[s.id] = s.mission?.missionCode || ''; });
      } catch (_) {}
    }

    const teams = await Team.findAll({ order: [['teamCode', 'ASC']], attributes: ['id', 'teamCode', 'name'] });
    const totalPages = Math.ceil(count / perPage);

    return res.json({
      logs: logs.map(l => {
        const valResult = l.validationResult || '';
        const statusMapped = valResult === 'pass' ? 'valid' : valResult === 'fail' ? 'invalid' : (valResult || 'error');
        const isFlagged = l.rejected || (l.injectionScore || 0) > 0.5;
        return {
          id: l.id,
          teamCode: l.team?.teamCode || 'N/A',
          teamName: l.team?.name || '',
          missionCode: submissionMissionMap[l.submissionId] || '',
          status: statusMapped,
          validationResult: valResult,
          parseResult: l.parseResult,
          confidenceScore: l.confidenceScore || 0,
          hallucinationScore: l.hallucinationProbability || 0,
          hallucinationProbability: l.hallucinationProbability || 0,
          injectionScore: l.injectionScore || 0,
          flagged: isFlagged,
          rejected: l.rejected,
          retryAttempt: l.retryAttempt,
          promptText: (l.promptText || '').substring(0, 500),
          createdAt: l.createdAt?.toISOString(),
        };
      }),
      teams: teams.map(t => ({ id: t.id, teamCode: t.teamCode, name: t.name })),
      totalPages,
      pagination: { total: count, page, perPage, pages: totalPages },
    });
  } catch (err) {
    console.error('api/logs error:', err);
    return res.status(500).json({ error: 'Failed to load logs' });
  }
});

// GET /admin/api/security — security events (paginated)
router.get('/api/security', ...apiAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const perPage = 25;
    const { severity, status } = req.query;
    const where = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;
    const { count, rows: events } = await SecurityEvent.findAndCountAll({
      where, order: [['createdAt', 'DESC']],
      limit: perPage, offset: (page - 1) * perPage,
    });

    // Batch-resolve teamCode from teamId
    const teamIds = [...new Set(events.map(e => e.teamId).filter(Boolean))];
    let teamCodeMap = {};
    if (teamIds.length > 0) {
      try {
        const tms = await Team.findAll({ where: { id: teamIds }, attributes: ['id', 'teamCode'], raw: true });
        tms.forEach(t => { teamCodeMap[t.id] = t.teamCode || t.team_code || ''; });
      } catch (_) {}
    }

    const totalPages = Math.ceil(count / perPage);
    return res.json({
      events: events.map(e => ({
        id: e.id, eventType: e.eventType, severity: e.severity,
        status: e.status, description: e.description,
        teamCode: teamCodeMap[e.teamId] || '—',
        ipAddress: e.ipAddress, teamId: e.teamId,
        createdAt: e.createdAt?.toISOString(),
        resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
        resolutionNotes: e.resolutionNotes || '',
      })),
      summary: {
        total: await SecurityEvent.count(),
        critical: await SecurityEvent.count({ where: { severity: 'critical' } }),
        open: await SecurityEvent.count({ where: { status: 'open' } }),
      },
      totalPages,
      pagination: { total: count, page, perPage, pages: totalPages },
    });
  } catch (err) {
    console.error('api/security error:', err);
    return res.status(500).json({ error: 'Failed to load security events' });
  }
});

// POST /admin/api/security/:eventId/resolve — resolve security event
router.post('/api/security/:eventId/resolve', ...apiAuth, async (req, res) => {
  try {
    const event = await SecurityEvent.findByPk(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    event.status = req.body.status || 'resolved';
    event.resolvedBy = req.user.id;
    event.resolvedAt = new Date();
    event.resolutionNotes = req.body.notes || '';
    await event.save();
    await AuditLogger.log('security_event_resolved', `Event ${event.id} resolved`, { userId: req.user.id });
    return res.json({ success: true, status: event.status });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resolve event' });
  }
});

// GET /admin/api/audit — audit trail (paginated)
router.get('/api/audit', ...apiAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const perPage = 50;
    const { action: actionFilter, severity: severityFilter } = req.query;
    const where = {};
    if (actionFilter) where.action = actionFilter;
    if (severityFilter) where.severity = severityFilter;
    const { count, rows: logs } = await AuditLog.findAndCountAll({
      where, order: [['createdAt', 'DESC']],
      limit: perPage, offset: (page - 1) * perPage,
    });
    const actionList = (await AuditLog.findAll({
      attributes: [[fn('DISTINCT', col('action')), 'action']], raw: true,
    })).map(r => r.action);
    const totalPages = Math.ceil(count / perPage);
    const mappedLogs = logs.map(l => ({
      id: l.id,
      action: l.action,
      severity: l.severity,
      // Fields expected by AuditPage
      actorId: l.userId || '—',
      targetType: l.resourceType || '',
      targetId: l.resourceId || '',
      details: l.description || '',
      ipAddress: l.ipAddress || '',
      // Original fields kept for compat
      description: l.description,
      userId: l.userId,
      teamId: l.teamId,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      createdAt: l.createdAt?.toISOString(),
    }));
    return res.json({
      logs: mappedLogs,
      entries: mappedLogs,
      actionList,
      totalPages,
      pagination: { total: count, page, perPage, pages: totalPages },
    });
  } catch (err) {
    console.error('api/audit error:', err);
    return res.status(500).json({ error: 'Failed to load audit trail' });
  }
});

// GET /admin/api/leaderboard — admin leaderboard view
router.get('/api/leaderboard', ...apiAuth, async (req, res) => {
  try {
    const teams = await Team.findAll({
      where: { status: { [Op.in]: ['active', 'locked'] } },
      order: [[literal('current_rank IS NULL'), 'ASC'], ['currentRank', 'ASC'], ['totalScore', 'DESC']],
    });
    const lbList = teams.map((t, idx) => ({
      id: t.id,
      rank: t.currentRank || (idx + 1),
      teamCode: t.teamCode,
      name: t.name,
      institution: t.institution || '',
      totalScore: Math.round((t.totalScore || 0) * 100) / 100,
      bonusPoints: Math.round((t.bonusPoints || 0) * 100) / 100,
      missionsCompleted: t.missionsCompleted,
      // Fields expected by LeaderboardPage
      submissionCount: t.totalSubmissions,
      successCount: t.successfulValidations,
      lastActivity: t.lastActivityAt ? t.lastActivityAt.toISOString() : null,
      // originals
      totalSubmissions: t.totalSubmissions,
      successfulValidations: t.successfulValidations,
      healthScore: Math.round((t.healthScore || 0) * 10) / 10,
      status: t.status,
      avatarColor: t.avatarColor,
      lastActivityAt: t.lastActivityAt ? t.lastActivityAt.toISOString() : null,
    }));
    return res.json({
      leaderboard: lbList,
      teams: lbList,
    });
  } catch (err) {
    console.error('api/leaderboard error:', err);
    return res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// POST /admin/api/leaderboard/recalculate — force recalculation
router.post('/api/leaderboard/recalculate', ...apiAuth, async (req, res) => {
  try {
    const rankings = await ScoringEngine.recalculateRankings();
    await AuditLogger.log('leaderboard_recalculated',
      `Leaderboard recalculated via React. ${rankings.length} teams ranked.`,
      { userId: req.user.id });
    return res.json({ success: true, ranked: rankings.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to recalculate rankings' });
  }
});

// ==============================================================================
// CSV / XLSX BULK TEAM IMPORT
// POST /admin/api/import-teams
// Accepts multipart/form-data with 'file' field (CSV or XLSX, max 2MB)
// Required columns: team_code, team_name, member_name, email
// ==============================================================================
const importUpload = multer
  ? multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/octet-stream',
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
          return cb(null, true);
        }
        cb(new Error('Only CSV / XLSX files are accepted'));
      },
    })
  : null;

router.post('/api/import-teams', ...apiAuth, async (req, res) => {
  // Multer middleware inline if available
  const runUpload = importUpload
    ? (r, rsp) => new Promise((resolve, reject) => {
        importUpload.single('file')(r, rsp, (err) => (err ? reject(err) : resolve()));
      })
    : null;

  if (!runUpload) {
    return res.status(503).json({ error: 'File upload support not installed. Run: npm install multer' });
  }
  if (!ExcelJS) {
    return res.status(503).json({ error: 'Excel parsing not installed. Run: npm install exceljs' });
  }

  try {
    await runUpload(req, res);
  } catch (uploadErr) {
    return res.status(400).json({ error: uploadErr.message || 'File upload failed' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use multipart/form-data with field name "file"' });
  }

  // Parse the file (CSV or XLSX)
  let rows;
  try {
    const isCsv = /\.csv$/i.test(req.file.originalname) || req.file.mimetype === 'text/csv';
    if (isCsv) {
      // Simple CSV parser — handles standard comma-separated data
      const text = req.file.buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV is empty or has no data rows');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
      rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = values[i] !== undefined ? values[i] : ''; });
        return obj;
      });
    } else {
      // XLSX via exceljs
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error('Workbook has no sheets');
      let headers = null;
      rows = [];
      sheet.eachRow((row, rowNum) => {
        const vals = row.values.slice(1); // exceljs index 0 is always undefined
        if (rowNum === 1) {
          headers = vals.map(h => String(h || '').trim().toLowerCase());
        } else {
          if (!headers) return;
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i] !== undefined ? String(vals[i]).trim() : ''; });
          rows.push(obj);
        }
      });
      if (!rows.length) throw new Error('Sheet is empty');
    }
  } catch (parseErr) {
    return res.status(422).json({ error: 'Failed to parse file: ' + parseErr.message });
  }

  if (!rows || !rows.length) return res.status(422).json({ error: 'File contains no data rows' });

  // Validate headers
  const firstRow = rows[0];
  const requiredCols = ['team_code', 'team_name'];
  const missing = requiredCols.filter(c => !(c in firstRow));
  if (missing.length) {
    return res.status(422).json({
      error: `Missing required columns: ${missing.join(', ')}`,
      hint: 'Required columns: team_code, team_name, member_name (optional), email (optional)',
    });
  }

  const summary = { created_teams: 0, created_members: 0, skipped_rows: 0, errors: [] };
  const t = await sequelize.transaction();

  try {
    for (const [idx, row] of rows.entries()) {
      const teamCode = String(row.team_code || '').trim().toUpperCase();
      const teamName = String(row.team_name || '').trim();
      const memberName = String(row.member_name || row.name || '').trim();
      const email = String(row.email || '').trim();
      const password = String(row.password || row.login_password || '').trim();

      if (!teamCode || !teamName) {
        summary.skipped_rows++;
        summary.errors.push(`Row ${idx + 2}: Missing team_code or team_name`);
        continue;
      }

      // Upsert team
      let [team, teamCreated] = await Team.findOrCreate({
        where: { teamCode },
        defaults: {
          teamCode, name: teamName,
          institution: String(row.institution || '').trim(),
          loginPassword: password || null,
          status: 'active',
        },
        transaction: t,
      });

      if (teamCreated) {
        summary.created_teams++;
      }

      // Create member if email and memberName provided
      if (email && memberName) {
        const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + '_' + teamCode.toLowerCase();
        const existingUser = await User.findOne({ where: { email }, transaction: t });

        let user = existingUser;
        if (!user) {
          user = User.build({ username, email, role: 'team_member' });
          await user.setPassword(password || 'changeme123');
          await user.save({ transaction: t });
        }

        const existingMember = await TeamMember.findOne({
          where: { teamId: team.id, userId: user.id },
          transaction: t,
        });

        if (!existingMember) {
          await TeamMember.create({ teamId: team.id, userId: user.id, roleInTeam: 'member' }, { transaction: t });
          summary.created_members++;
        }
      }
    }

    await t.commit();

    await AuditLogger.log('bulk_import', `Bulk import: ${summary.created_teams} teams, ${summary.created_members} members, ${summary.skipped_rows} skipped`, {
      userId: req.user?.id, severity: 'warning',
    });

    return res.json({
      success: true,
      summary,
      message: `Import complete: ${summary.created_teams} teams created, ${summary.created_members} members added, ${summary.skipped_rows} rows skipped`,
    });
  } catch (importErr) {
    await t.rollback();
    console.error('import-teams error:', importErr);
    return res.status(500).json({ error: 'Import failed: ' + importErr.message });
  }
});

// ==============================================================================
// GAME TIMER ENDPOINTS  (apiAuth — JWT admin only)
// ==============================================================================

// GET /admin/api/timer — current timer state
router.get('/api/timer', ...apiAuth, (req, res) => {
  return res.json(TimerEngine.getState());
});

// POST /admin/api/timer/start   body: { totalSeconds: number }
router.post('/api/timer/start', ...apiAuth, async (req, res) => {
  const secs = parseInt(req.body.totalSeconds || 3600);
  if (isNaN(secs) || secs < 1) return res.status(400).json({ error: 'totalSeconds must be a positive integer' });
  const state = TimerEngine.start(secs);
  await AuditLogger.log('timer_started', `Game timer started: ${secs}s`, { userId: req.user.id });
  return res.json(state);
});

// POST /admin/api/timer/pause
router.post('/api/timer/pause', ...apiAuth, async (req, res) => {
  const state = TimerEngine.pause();
  await AuditLogger.log('timer_paused', 'Game timer paused', { userId: req.user.id });
  return res.json(state);
});

// POST /admin/api/timer/resume
router.post('/api/timer/resume', ...apiAuth, async (req, res) => {
  const state = TimerEngine.resume();
  await AuditLogger.log('timer_resumed', 'Game timer resumed', { userId: req.user.id });
  return res.json(state);
});

// POST /admin/api/timer/reset
router.post('/api/timer/reset', ...apiAuth, async (req, res) => {
  const state = TimerEngine.reset();
  await AuditLogger.log('timer_reset', 'Game timer reset', { userId: req.user.id });
  return res.json(state);
});

// POST /admin/api/timer/adjust  body: { delta: number }  (seconds, positive or negative)
router.post('/api/timer/adjust', ...apiAuth, (req, res) => {
  const delta = parseInt(req.body.delta || 0);
  return res.json(TimerEngine.adjust(delta));
});

// POST /admin/api/timer/duration  body: { totalSeconds: number }  (change duration mid-game)
router.post('/api/timer/duration', ...apiAuth, (req, res) => {
  const secs = parseInt(req.body.totalSeconds || 3600);
  if (isNaN(secs) || secs < 1) return res.status(400).json({ error: 'totalSeconds must be a positive integer' });
  return res.json(TimerEngine.setDuration(secs));
});

module.exports = router;

