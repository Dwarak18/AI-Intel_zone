// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Scoring Engine — Leaderboard & Score Calculation
// ==============================================================================

const { Team, Submission, Mission, Achievement, LeaderboardCache, sequelize } = require('./models');
const { Op } = require('sequelize');
const config = require('./config');

class ScoringEngine {
  static get weights() {
    return config.weights;
  }

  static get bonuses() {
    return config.bonuses;
  }

  // ==============================================================================
  // MISSION SCORE CALCULATION
  // ==============================================================================
  static async calculateMissionScore(submission, mission, team) {
    const weights = this.weights;

    // Accuracy Score (0-100)
    const accuracy = this.calculateAccuracy(submission, mission);

    // Speed Score (0-100)
    const speed = this.calculateSpeedScore(submission, mission, team);

    // Validation Score (0-100)
    const validation = this.calculateValidationScore(team);

    // Weighted Total
    const baseScore = 
      (accuracy * weights.accuracy) +
      (speed * weights.speed) +
      (validation * weights.validation);

    // Retry penalty (exponential decay)
    const attempt = Math.max(0, submission.attemptNumber - 1);
    let retryPenalty = Math.exp(-0.1 * attempt);

    // Anti-brute-force penalty
    const bruteForcePenalty = await this.calculateBruteForcePenalty(submission, mission);
    if (bruteForcePenalty < 1.0) {
      retryPenalty = retryPenalty * bruteForcePenalty;
    }

    const penalizedScore = baseScore * retryPenalty;

    // Scale to mission max points
    const finalScore = (penalizedScore / 100) * mission.maxPoints;

    return {
      accuracyScore: Math.round(accuracy * 100) / 100,
      speedScore: Math.round(speed * 100) / 100,
      validationScore: Math.round(validation * 100) / 100,
      baseScore: Math.round(baseScore * 100) / 100,
      retryPenalty: Math.round(retryPenalty * 10000) / 10000,
      bruteForcePenalty: Math.round(bruteForcePenalty * 10000) / 10000,
      penalizedScore: Math.round(penalizedScore * 100) / 100,
      finalScore: Math.round(finalScore * 100) / 100,
      maxPossible: mission.maxPoints,
      attemptNumber: submission.attemptNumber,
    };
  }

  static async calculateBruteForcePenalty(submission, mission) {
    const attempt = submission.attemptNumber;
    if (attempt <= 3) return 1.0;

    let tierPenalty;
    if (attempt <= 6) {
      const extra = attempt - 3;
      tierPenalty = Math.pow(0.85, extra);
    } else {
      const extraMid = 3;
      const extraHigh = attempt - 6;
      tierPenalty = Math.pow(0.85, extraMid) * Math.pow(0.70, extraHigh);
    }

    const repeatMultiplier = await this.detectRepeatedResponse(submission, mission);
    return Math.round(tierPenalty * repeatMultiplier * 10000) / 10000;
  }

  static async detectRepeatedResponse(submission, mission) {
    // Check if this team has submitted the same raw response before
    const duplicates = await Submission.count({
      where: {
        teamId: submission.teamId,
        missionId: mission.id,
        aiRawResponse: submission.aiRawResponse,
        id: { [Op.ne]: submission.id },
      },
    });

    if (duplicates === 0) return 1.0;
    return Math.max(0.25, Math.pow(0.5, duplicates));
  }

  static calculateAccuracy(submission, mission) {
    // Base accuracy from confidence score
    const base = (submission.confidenceScore || 0) * 100;

    // Schema compliance multiplier
    let multiplier;
    if (submission.schemaValid && submission.jsonValid && submission.typeCheckValid) {
      multiplier = 1.0;
    } else if (submission.jsonValid && submission.schemaValid) {
      multiplier = 0.8;
    } else if (submission.jsonValid) {
      multiplier = 0.5;
    } else {
      multiplier = 0.0;
    }

    return Math.min(100, base * multiplier);
  }

  static calculateSpeedScore(submission, mission, team) {
    if (!submission.responseTimeMs || !mission.timeLimitSeconds) {
      return 50; // Default middle score
    }

    const timeLimitMs = mission.timeLimitSeconds * 1000;
    const timeTakenMs = submission.responseTimeMs;

    const timeRatio = timeTakenMs / timeLimitMs;
    return Math.max(0, 100 - (timeRatio * 100));
  }

  static calculateValidationScore(team) {
    if (team.totalSubmissions === 0) return 100;
    return (team.successfulValidations / team.totalSubmissions) * 100;
  }

  // ==============================================================================
  // BONUS CALCULATION
  // ==============================================================================
  static async checkAndAwardBonuses(submission, mission, team) {
    const bonusConfig = this.bonuses;
    const awarded = [];

    // First Blood
    if (!mission.firstBloodTeamId && submission.validationStatus === 'valid') {
      mission.firstBloodTeamId = team.id;
      mission.firstBloodAt = new Date();
      await mission.save();

      const bonus = bonusConfig.firstBlood;
      awarded.push(await this.createAchievement(
        team, 'first_blood', '🩸 First Blood',
        `First to complete mission: ${mission.title}`,
        '🩸', bonus, mission.id
      ));
    }

    // Perfect Parse
    if (submission.attemptNumber === 1 &&
        submission.validationStatus === 'valid' &&
        (!submission.validationErrors || submission.validationErrors === '[]')) {
      const bonus = bonusConfig.perfectParse;
      awarded.push(await this.createAchievement(
        team, 'perfect_parse', '✨ Perfect Parse',
        `Zero errors on first try: ${mission.title}`,
        '✨', bonus, mission.id
      ));
    }

    // Speed Demon
    if (submission.responseTimeMs && mission.timeLimitSeconds &&
        submission.responseTimeMs < (mission.timeLimitSeconds * 1000 * 0.25)) {
      const bonus = bonusConfig.speedDemon;
      awarded.push(await this.createAchievement(
        team, 'speed_demon', '⚡ Speed Demon',
        `Blazing fast completion: ${mission.title}`,
        '⚡', bonus, mission.id
      ));
    }

    // Consistency
    const recentSubs = await Submission.findAll({
      where: { teamId: team.id, validationStatus: 'valid' },
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    if (recentSubs.length >= 5) {
      const existing = await Achievement.findOne({
        where: { teamId: team.id, achievementType: 'consistency' },
      });
      if (!existing) {
        const bonus = bonusConfig.consistency;
        awarded.push(await this.createAchievement(
          team, 'consistency', '🎯 Consistency King',
          '5 consecutive valid submissions',
          '🎯', bonus
        ));
      }
    }

    // Efficient Prompt
    if (submission.promptLength && submission.promptLength <= 200 &&
        submission.confidenceScore && submission.confidenceScore >= 0.95 &&
        submission.validationStatus === 'valid') {
      const existing = await Achievement.findOne({
        where: { teamId: team.id, achievementType: 'efficient_prompt', missionId: mission.id },
      });
      if (!existing) {
        const bonus = bonusConfig.efficientPrompt;
        awarded.push(await this.createAchievement(
          team, 'efficient_prompt', '⚡ Efficient Prompt',
          `Concise prompt (≤200 chars) with high confidence (≥95%): ${mission.title}`,
          '⚡', bonus, mission.id
        ));
      }
    }

    return awarded;
  }

  static async createAchievement(team, atype, title, desc, icon, points, missionId = null) {
    const achievement = await Achievement.create({
      teamId: team.id,
      achievementType: atype,
      title,
      description: desc,
      icon,
      pointsAwarded: points,
      missionId,
    });
    team.bonusPoints += points;
    await team.save();
    return achievement.toDict();
  }

  // ==============================================================================
  // LEADERBOARD RANKING
  // ==============================================================================
  static async recalculateRankings() {
    const teams = await Team.findAll({
      where: { status: { [Op.in]: ['active', 'locked'] } },
    });

    // Compute sort data for each team
    const teamData = [];
    for (const team of teams) {
      const latestSub = await Submission.findOne({
        where: { teamId: team.id },
        order: [['createdAt', 'DESC']],
      });
      const latestTs = latestSub ? latestSub.createdAt.getTime() : Infinity;

      const avgConfResult = await Submission.findOne({
        attributes: [[sequelize.fn('AVG', sequelize.col('confidence_score')), 'avgConf']],
        where: { teamId: team.id },
        raw: true,
      });
      const avgConfidence = avgConfResult?.avgConf || 0;

      teamData.push({
        team,
        totalScore: team.totalScore + team.bonusPoints,
        totalSubmissions: team.totalSubmissions,
        latestTimestamp: latestTs,
        avgConfidence,
        hallucinationCount: team.hallucinationCount,
      });
    }

    // Sort with tie-break logic
    teamData.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (a.totalSubmissions !== b.totalSubmissions) return a.totalSubmissions - b.totalSubmissions;
      if (a.latestTimestamp !== b.latestTimestamp) return a.latestTimestamp - b.latestTimestamp;
      if (b.avgConfidence !== a.avgConfidence) return b.avgConfidence - a.avgConfidence;
      return a.hallucinationCount - b.hallucinationCount;
    });

    // Wipe previous snapshot
    await LeaderboardCache.destroy({ where: {} });

    const now = new Date();
    const rankedOutput = [];

    for (let rank = 1; rank <= teamData.length; rank++) {
      const data = teamData[rank - 1];
      const team = data.team;
      team.currentRank = rank;
      await team.save();

      const firstValidAt = await Submission.min('createdAt', {
        where: { teamId: team.id, validationStatus: 'valid' },
      });

      await LeaderboardCache.create({
        teamId: team.id,
        rank,
        totalScore: Math.round(data.totalScore * 10000) / 10000,
        bonusPoints: team.bonusPoints,
        missionsCompleted: team.missionsCompleted,
        totalSubmissions: team.totalSubmissions,
        validationRate: Math.round(team.validationRate * 10000) / 10000,
        healthScore: Math.round(this.calculateHealthScore(team) * 10000) / 10000,
        firstValidAt,
        snapshotAt: now,
      });

      rankedOutput.push({
        rank,
        teamCode: team.teamCode,
        name: team.name,
        totalScore: Math.round(data.totalScore * 100) / 100,
        missionsCompleted: team.missionsCompleted,
        totalSubmissions: team.totalSubmissions,
        validationRate: Math.round(team.validationRate * 10) / 10,
      });
    }

    return rankedOutput;
  }

  // ==============================================================================
  // TEAM HEALTH SCORE
  // ==============================================================================
  static calculateHealthScore(team) {
    const scores = [];

    // Activity score
    if (team.totalSubmissions > 0) {
      scores.push(Math.min(100, team.totalSubmissions * 10));
    } else {
      scores.push(0);
    }

    // Error rate score (inverse)
    scores.push(Math.max(0, 100 - team.errorRate));

    // Validation quality
    scores.push(team.validationRate);

    // Hallucination penalty
    const hallucPenalty = Math.min(50, team.hallucinationCount * 5);
    scores.push(Math.max(0, 100 - hallucPenalty));

    const health = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return Math.round(Math.min(100, Math.max(0, health)) * 10) / 10;
  }
}

module.exports = ScoringEngine;
