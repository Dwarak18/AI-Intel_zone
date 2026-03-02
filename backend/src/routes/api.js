// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// API Routes — RESTful endpoints for Team Portal
// ==============================================================================

const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { Team, Mission, Submission, AILog, TeamMember, Achievement, sequelize } = require('../models');
const { ValidationEngine, HallucinationDetector } = require('../validationEngine');
const ScoringEngine = require('../scoringEngine');
const { InjectionDetector, AuditLogger } = require('../security');
const { runMissionValidation } = require('../missionEngine');
const { jwtRequired } = require('../authMiddleware');
const config = require('../config');
const { broadcastLiveScores } = require('../sockets');

// ==============================================================================
// HEALTH CHECK
// ==============================================================================
router.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    return res.json({
      status: 'operational',
      database: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
    });
  } catch (err) {
    return res.json({
      status: 'degraded',
      database: 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  }
});

// ==============================================================================
// SUBMISSION ENDPOINT
// ==============================================================================
router.post('/submit', jwtRequired, async (req, res) => {
  const data = req.body;
  if (!data) return res.status(400).json({ error: 'JSON request body required' });

  let teamId = data.team_id;
  let missionId = data.mission_id;
  const promptText = (data.prompt_text || data.prompt || '').trim();
  const aiResponse = (data.ai_response || data.response || '').trim();

  if (promptText && !aiResponse) {
    return res.status(400).json({
      error: 'ai_response is required. Submit the AI-generated output, not just the prompt.',
      hint: 'Fields accepted: ai_response or response',
    });
  }

  // Derive team from logged-in user if team_id omitted
  if (!teamId && req.user) {
    const membership = await TeamMember.findOne({ where: { userId: req.user.id, isActive: true } });
    if (membership) teamId = membership.teamId;
  }

  // Auto-pick first available mission if missing
  if (!missionId) {
    const autoMission = await Mission.findOne({
      where: { isActive: true, isVisible: true },
      order: [['orderIndex', 'ASC']],
    });
    if (autoMission) missionId = autoMission.id;
  }

  if (!teamId || !missionId || !promptText || !aiResponse) {
    return res.status(400).json({
      error: 'Missing required fields. Required: prompt (or prompt_text), team_id, mission_id, ai_response',
    });
  }

  const team = await Team.findByPk(teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (team.status !== 'active') return res.status(403).json({ error: `Team is ${team.status}. Cannot submit.` });

  const mission = await Mission.findByPk(missionId);
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  if (!mission.isActive || !mission.isVisible) return res.status(403).json({ error: 'Mission is not currently available' });

  // Check retry limit
  const attemptCount = await Submission.count({ where: { teamId, missionId } });
  const maxRetries = mission.maxRetries || config.maxRetriesPerMission;
  if (attemptCount >= maxRetries) {
    return res.status(429).json({
      error: `Maximum retries (${maxRetries}) reached for this mission`,
      attemptsUsed: attemptCount,
    });
  }

  // Injection Detection
  const injectionResult = InjectionDetector.analyze(promptText);
  const isInjection = injectionResult.isSuspicious;

  if (isInjection) {
    await AuditLogger.logSecurityEvent(
      'injection_attempt',
      `Prompt injection detected from team ${team.teamCode}`,
      {
        severity: injectionResult.injectionScore > 0.8 ? 'high' : 'medium',
        teamId, userId: req.user?.id,
        evidence: injectionResult,
        ipAddress: req.ip,
      }
    );
    if (injectionResult.injectionScore > 0.9) {
      return res.status(403).json({
        error: 'Submission rejected: suspicious content detected',
        submissionId: null,
        flagged: true,
      });
    }
  }

  // Run Validation Engine
  const schema = mission.getSchema();
  let expectedFields = null;
  let regexPatterns = null;
  try { expectedFields = mission.expectedFields ? JSON.parse(mission.expectedFields) : null; } catch (e) {}
  try { regexPatterns = mission.validationRegex ? JSON.parse(mission.validationRegex) : null; } catch (e) {}

  const validation = ValidationEngine.validate(aiResponse, schema, expectedFields, regexPatterns, true);

  // Mission-level logic validation
  let missionResult = null;
  if (validation.jsonValid && validation.parsedData !== null) {
    missionResult = runMissionValidation(validation.parsedData, mission);
    for (const err of missionResult.errors) {
      validation.addError(err.msg, err.category);
    }
    if (!missionResult.passed) {
      validation.schemaValid = false;
    }
  }

  // Hallucination Detection
  const hallucinationProb = HallucinationDetector.estimateProbability(promptText, aiResponse, validation.parsedData);

  // Create Submission Record
  const submission = Submission.build({
    teamId,
    missionId,
    submittedBy: req.user?.id || null,
    attemptNumber: attemptCount + 1,
    promptText,
    aiRawResponse: aiResponse,
    parsedResponse: validation.parsedData ? JSON.stringify(validation.parsedData) : null,
    validationStatus: validation.overallStatus,
    jsonValid: validation.jsonValid,
    schemaValid: validation.schemaValid,
    typeCheckValid: validation.typeCheckValid,
    regexValid: validation.regexValid,
    fieldCountValid: validation.fieldCountValid,
    validationErrors: JSON.stringify(validation.errors),
    confidenceScore: validation.confidenceScore,
    promptLength: promptText.length,
    responseLength: aiResponse.length,
    ipAddress: req.ip,
    userAgent: (req.get('User-Agent') || '').substring(0, 500),
    isFlagged: isInjection,
    flagReason: isInjection ? 'Injection patterns detected' : null,
    injectionDetected: isInjection,
    isHallucinated: hallucinationProb > 0.7,
    responseTimeMs: data.response_time_ms || null,
  });

  // Calculate Score
  let scoreResult = { finalScore: 0 };
  if (validation.overallStatus === 'valid') {
    scoreResult = ScoringEngine.calculateMissionScore(submission, mission, team);
    submission.accuracyScore = scoreResult.accuracyScore;
    submission.speedScore = scoreResult.speedScore;
    submission.validationScore = scoreResult.validationScore;
    submission.totalScore = scoreResult.finalScore;

    team.successfulValidations += 1;
    const distinctMissions = await Submission.count({
      distinct: true,
      col: 'mission_id',
      where: { teamId, validationStatus: 'valid' },
    });
    team.missionsCompleted = distinctMissions;
    team.totalScore += scoreResult.finalScore;
    mission.totalCompletions += 1;
  } else {
    team.failedValidations += 1;
  }

  // Update Team Metrics
  team.totalSubmissions += 1;
  team.lastActivityAt = new Date();
  team.errorRate = (team.failedValidations / team.totalSubmissions) * 100;
  if (hallucinationProb > 0.7) team.hallucinationCount += 1;
  team.healthScore = ScoringEngine.calculateHealthScore(team);
  mission.totalAttempts += 1;

  // Persist
  await submission.save();

  // Create AI Log
  const aiLog = await AILog.create({
    teamId,
    submissionId: submission.id,
    userId: req.user?.id || null,
    promptText,
    aiRawOutput: aiResponse,
    aiParsedOutput: validation.parsedData ? JSON.stringify(validation.parsedData) : null,
    parseResult: validation.jsonValid ? 'success' : 'failed',
    validationResult: validation.isValid ? 'pass' : 'fail',
    errorDetails: validation.errors.length ? JSON.stringify(validation.errors) : null,
    rejected: isInjection && injectionResult.injectionScore > 0.9,
    retryAttempt: attemptCount,
    confidenceScore: validation.confidenceScore,
    hallucinationProbability: hallucinationProb,
    injectionScore: injectionResult.injectionScore,
    suspiciousPatterns: injectionResult.patternsFound.length ? JSON.stringify(injectionResult.patternsFound) : null,
    ipAddress: req.ip,
    responseLatencyMs: data.response_time_ms || null,
  });

  await team.save();
  await mission.save();

  // Check & Award Bonuses
  let bonusAwarded = 0;
  let bonusType = '';
  if (validation.overallStatus === 'valid') {
    const bonuses = await ScoringEngine.checkAndAwardBonuses(submission, mission, team);
    if (bonuses.length) {
      bonusAwarded = bonuses.reduce((sum, b) => sum + (b.pointsAwarded || 0), 0);
      bonusType = bonuses.map(b => b.achievementType).join(', ');
      submission.bonusAwarded = bonusAwarded;
      submission.bonusType = bonusType;
      await submission.save();
    }
    await ScoringEngine.recalculateRankings();

    // Broadcast live scores update via Socket.IO
    try {
      const { Op, literal } = require('sequelize');
      const rankedTeams = await Team.findAll({
        order: [[literal('current_rank IS NULL'), 'ASC'], ['currentRank', 'ASC']],
        limit: 50,
      });
      broadcastLiveScores(rankedTeams.map(t => ({
        rank: t.currentRank,
        teamCode: t.teamCode,
        name: t.name,
        totalScore: Math.round(t.totalScore * 100) / 100,
        bonusPoints: Math.round(t.bonusPoints * 100) / 100,
        combinedScore: Math.round((t.totalScore + t.bonusPoints) * 100) / 100,
        missionsCompleted: t.missionsCompleted,
        totalSubmissions: t.totalSubmissions,
        validationRate: t.totalSubmissions > 0
          ? Math.round(t.successfulValidations / t.totalSubmissions * 1000) / 10 : 0,
        healthScore: Math.round(t.healthScore * 10) / 10,
        status: t.status,
        avatarColor: t.avatarColor,
      })));
    } catch (broadcastErr) {
      console.warn('Live scores broadcast failed:', broadcastErr.message);
    }
  }

  // Audit Log
  await AuditLogger.log(
    'submission_created',
    `Team ${team.teamCode} submitted for mission ${mission.missionCode} (attempt #${attemptCount + 1}, status: ${validation.overallStatus})`,
    { resourceType: 'submission', resourceId: submission.id, teamId, userId: req.user?.id }
  );

  // Response
  return res.status(201).json({
    submissionId: submission.id,
    status: validation.overallStatus,
    attemptNumber: attemptCount + 1,
    attemptsRemaining: maxRetries - (attemptCount + 1),
    validation: validation.toParticipantDict(),
    score: {
      total: Math.round(submission.totalScore * 100) / 100,
      accuracy: Math.round(submission.accuracyScore * 100) / 100,
      speed: Math.round(submission.speedScore * 100) / 100,
      confidence: Math.round(submission.confidenceScore * 1000) / 1000,
      bonus: Math.round(submission.bonusAwarded * 100) / 100,
    },
    teamStats: {
      totalScore: Math.round(team.totalScore * 100) / 100,
      rank: team.currentRank,
      healthScore: Math.round(team.healthScore * 10) / 10,
    },
  });
});

// ==============================================================================
// SANDBOX ENDPOINT (no persistence)
// ==============================================================================
router.post('/sandbox', jwtRequired, async (req, res) => {
  const data = req.body;
  if (!data) return res.status(400).json({ error: 'JSON request body required' });

  const missionId = data.mission_id;
  const promptText = (data.prompt_text || data.prompt || '').trim();
  const aiResponse = (data.ai_response || data.response || '').trim();

  if (!aiResponse) return res.status(400).json({ error: 'ai_response is required' });
  if (!promptText) return res.status(400).json({ error: 'prompt_text is required' });

  let mission = null;
  if (missionId) mission = await Mission.findByPk(missionId);

  const schema = mission?.getSchema() || null;
  let expectedFields = null;
  let regexPatterns = null;
  try { expectedFields = mission?.expectedFields ? JSON.parse(mission.expectedFields) : null; } catch (e) {}
  try { regexPatterns = mission?.validationRegex ? JSON.parse(mission.validationRegex) : null; } catch (e) {}

  const validation = ValidationEngine.validate(aiResponse, schema, expectedFields, regexPatterns, true);

  if (mission && validation.jsonValid && validation.parsedData !== null) {
    const missionResult = runMissionValidation(validation.parsedData, mission);
    for (const err of missionResult.errors) {
      validation.addError(err.msg, err.category);
    }
    if (!missionResult.passed) validation.schemaValid = false;
  }

  return res.json({
    sandbox: true,
    persisted: false,
    validation: validation.toParticipantDict(),
    mission: mission ? mission.toDict() : null,
  });
});

// ==============================================================================
// LEADERBOARD (public)
// ==============================================================================
router.get('/leaderboard', async (req, res) => {
  try {
    const sortBy = req.query.sort_by || 'score';
    const limit = Math.min(parseInt(req.query.limit || 50), 100);
    const { Op, literal } = require('sequelize');

    let order;
    if (sortBy === 'accuracy' || sortBy === 'validation_rate') {
      order = [[literal('CASE WHEN total_submissions > 0 THEN successful_validations * 100.0 / total_submissions ELSE 0 END'), 'DESC']];
    } else if (sortBy === 'speed') {
      order = [['avgResponseTime', 'ASC']];
    } else {
      order = [[literal('current_rank IS NULL'), 'ASC'], ['currentRank', 'ASC']];
    }

    const teams = await Team.findAll({
      where: { status: { [Op.in]: ['active', 'locked'] } },
      order,
      limit,
    });

    return res.json({
      leaderboard: teams.map(t => t.toLeaderboardDict()),
      totalTeams: await Team.count({ where: { status: 'active' } }),
      sortBy,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.json({ error: 'Failed to load leaderboard', leaderboard: [] });
  }
});

// ==============================================================================
// TEAM ENDPOINTS
// ==============================================================================
router.get('/team/:teamId', jwtRequired, async (req, res) => {
  const team = await Team.findByPk(req.params.teamId, {
    include: [{ model: TeamMember, as: 'members', include: [{ model: require('../models').User, as: 'user' }] }],
  });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  return res.json({ team: team.toDict(true) });
});

router.get('/team/:teamId/submissions', jwtRequired, async (req, res) => {
  const team = await Team.findByPk(req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const page = parseInt(req.query.page || 1);
  const perPage = Math.min(parseInt(req.query.per_page || 20), 100);
  const where = { teamId: req.params.teamId };
  if (req.query.mission_id) where.missionId = req.query.mission_id;

  const { count, rows } = await Submission.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: perPage,
    offset: (page - 1) * perPage,
  });

  return res.json({
    submissions: rows.map(s => s.toDict()),
    total: count,
    page,
    perPage,
    pages: Math.ceil(count / perPage),
  });
});

router.get('/team/:teamId/achievements', jwtRequired, async (req, res) => {
  const team = await Team.findByPk(req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const achievements = await Achievement.findAll({
    where: { teamId: req.params.teamId },
    order: [['awardedAt', 'DESC']],
  });
  return res.json({
    achievements: achievements.map(a => a.toDict()),
    totalBonus: Math.round(team.bonusPoints * 100) / 100,
  });
});

// ==============================================================================
// MISSION ENDPOINTS
// ==============================================================================
router.get('/missions', jwtRequired, async (req, res) => {
  const missions = await Mission.findAll({
    where: { isActive: true, isVisible: true },
    order: [['orderIndex', 'ASC']],
  });
  return res.json({
    missions: missions.map(m => m.toDict(true)),
    total: missions.length,
  });
});

router.get('/missions/:missionId', jwtRequired, async (req, res) => {
  const mission = await Mission.findByPk(req.params.missionId);
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  return res.json({ mission: mission.toDict(true) });
});

router.get('/missions/:missionId/history', jwtRequired, async (req, res) => {
  let team = null;
  if (req.user) {
    const membership = await TeamMember.findOne({ where: { userId: req.user.id, isActive: true } });
    if (membership) team = await Team.findByPk(membership.teamId);
  }
  if (!team) return res.status(401).json({ error: 'Team not authenticated' });

  const subs = await Submission.findAll({
    where: { teamId: team.id, missionId: req.params.missionId },
    order: [['createdAt', 'ASC']],
  });

  const rows = subs.map(s => {
    let errors = [];
    try { errors = s.validationErrors ? JSON.parse(s.validationErrors) : []; } catch (e) {}
    return {
      id: s.id,
      attemptNumber: s.attemptNumber,
      validationStatus: s.validationStatus,
      scoreAwarded: s.totalScore,
      confidenceScore: s.confidenceScore,
      failureReason: errors[0] || null,
      errorMessage: errors.length ? errors.join('; ') : null,
      isSandbox: false,
      createdAt: s.createdAt?.toISOString() || null,
    };
  });

  return res.json({ submissions: rows, total: rows.length, missionId: req.params.missionId });
});

module.exports = router;
