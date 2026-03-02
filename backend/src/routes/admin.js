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
const { requireLogin } = require('../authMiddleware');
const ScoringEngine = require('../scoringEngine');

const auth = [requireLogin, requireAdmin];

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

router.get('/api/live-scores', ...auth, async (req, res) => {
  try {
    const { Op, literal } = require('sequelize');
    const teams = await Team.findAll({
      order: [
        [literal('current_rank IS NULL'), 'ASC'],
        ['currentRank', 'ASC'],
        ['totalScore', 'DESC'],
      ],
    });
    return res.json({
      teams: teams.map(t => ({
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
      })),
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

router.get('/api/logs/:logId', ...auth, async (req, res) => {
  try {
    const log = await AILog.findByPk(req.params.logId);
    if (!log) return res.status(404).json({ error: 'Log not found' });

    const team = await Team.findByPk(log.teamId);
    let missionTitle = null;
    if (log.submissionId) {
      const sub = await Submission.findByPk(log.submissionId, {
        include: [{ model: Mission, as: 'mission' }],
      });
      missionTitle = sub?.mission?.title || null;
    }

    return res.json({
      id: log.id,
      teamCode: team?.teamCode || 'N/A',
      missionTitle,
      createdAt: log.createdAt?.toISOString() || null,
      promptText: (log.promptText || '').substring(0, 10000),
      aiRawOutput: (log.aiRawOutput || '').substring(0, 20000),
      aiParsedOutput: (log.aiParsedOutput || '').substring(0, 15000),
      parseResult: log.parseResult,
      validationResult: log.validationResult,
      confidenceScore: log.confidenceScore || 0,
      hallucinationProbability: log.hallucinationProbability || 0,
      injectionScore: log.injectionScore || 0,
      rejected: log.rejected,
      rejectionReason: log.rejectionReason,
      errorDetails: (log.errorDetails || '').substring(0, 10000),
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
router.get('/api/stats', ...auth, async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const fiveMinAgo = new Date(Date.now() - 300000);

    const activeUsers = await Submission.count({
      distinct: true,
      col: 'team_id',
      where: { createdAt: { [Op.gte]: fiveMinAgo } },
    });

    return res.json({
      teams: {
        total: await Team.count(),
        active: await Team.count({ where: { status: 'active' } }),
        locked: await Team.count({ where: { status: 'locked' } }),
        disqualified: await Team.count({ where: { status: 'disqualified' } }),
      },
      submissions: {
        total: await Submission.count(),
        valid: await Submission.count({ where: { validationStatus: 'valid' } }),
        invalid: await Submission.count({ where: { validationStatus: 'invalid' } }),
        error: await Submission.count({ where: { validationStatus: 'error' } }),
        recentHour: await Submission.count({ where: { createdAt: { [Op.gte]: oneHourAgo } } }),
      },
      security: {
        openEvents: await SecurityEvent.count({ where: { status: 'open' } }),
        flagged: await Submission.count({ where: { isFlagged: true } }),
      },
      activeUsers5m: activeUsers,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('api_stats error:', err);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/api/activity_feed', ...auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || 20), 50);
    const recent = await Submission.findAll({
      include: [{ model: Team, as: 'team' }, { model: Mission, as: 'mission' }],
      order: [['createdAt', 'DESC']],
      limit,
    });

    const feed = recent.map(sub => ({
      id: sub.id,
      teamCode: sub.team?.teamCode || 'N/A',
      teamName: sub.team?.name || 'Unknown',
      mission: sub.mission?.title || 'Unknown Mission',
      status: sub.validationStatus,
      score: Math.round(sub.totalScore * 100) / 100,
      attempt: sub.attemptNumber,
      promptLength: sub.promptLength || (sub.promptText ? sub.promptText.length : 0),
      flagged: sub.isFlagged,
      suspicious: !!(sub.isFlagged || sub.injectionDetected || sub.isHallucinated),
      createdAt: sub.createdAt.toISOString(),
    }));

    return res.json({ feed });
  } catch (err) {
    console.error('api_activity_feed error:', err);
    return res.status(500).json({ error: 'Failed to load activity feed' });
  }
});

router.get('/api/analytics', ...auth, async (req, res) => {
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

    return res.json({
      hourly: Object.values(buckets),
      statusCounts: {
        valid: await Submission.count({ where: { validationStatus: 'valid' } }),
        invalid: await Submission.count({ where: { validationStatus: 'invalid' } }),
        error: await Submission.count({ where: { validationStatus: 'error' } }),
      },
      activeTeams15m: activeTeams,
      hallucinationRate: Math.round((hallucinationTotal / Math.max(subTotal, 1)) * 100 * 100) / 100,
      serverLoad: {
        queueDepth: await SecurityEvent.count({ where: { status: 'open' } }),
        eventsOpen: await SecurityEvent.count({ where: { status: 'open' } }),
      },
    });
  } catch (err) {
    console.error('api_analytics error:', err);
    return res.status(500).json({ error: 'Failed to load analytics' });
  }
});

module.exports = router;
