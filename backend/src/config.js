// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Application Configuration
// ==============================================================================

require('dotenv').config();

const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',

  // Security
  secretKey: process.env.SECRET_KEY || 'dev-secret-change-me',
  jwtSecretKey: process.env.JWT_SECRET_KEY || 'dev-jwt-secret-change-me',
  jwtExpiryHours: parseInt(process.env.JWT_EXPIRY_HOURS, 10) || 8,
  sessionLifetimeMinutes: parseInt(process.env.SESSION_LIFETIME_MINUTES, 10) || 120,

  // Database
  databaseUrl: process.env.DATABASE_URL || 'sqlite:./data/control_arena.db',

  // Redis (optional)
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/0',

  // Competition
  competitionName: process.env.COMPETITION_NAME || 'AI Intelligence Zone — Control Arena',
  maxTeams: parseInt(process.env.MAX_TEAMS, 10) || 50,
  maxTeamMembers: parseInt(process.env.MAX_TEAM_MEMBERS, 10) || 4,
  maxRetriesPerMission: parseInt(process.env.MAX_RETRIES_PER_MISSION, 10) || 20,
  submissionCooldownSeconds: parseInt(process.env.SUBMISSION_COOLDOWN_SECONDS, 10) || 10,

  // Scoring Weights
  weights: {
    accuracy: parseFloat(process.env.WEIGHT_ACCURACY) || 0.50,
    speed: parseFloat(process.env.WEIGHT_SPEED) || 0.20,
    validation: parseFloat(process.env.WEIGHT_VALIDATION) || 0.30,
  },

  // Bonuses
  bonuses: {
    firstBlood: parseInt(process.env.FIRST_BLOOD_BONUS, 10) || 50,
    perfectParse: parseInt(process.env.PERFECT_PARSE_BONUS, 10) || 25,
    speedDemon: parseInt(process.env.SPEED_DEMON_BONUS, 10) || 30,
    consistency: parseInt(process.env.CONSISTENCY_BONUS, 10) || 20,
    efficientPrompt: parseInt(process.env.EFFICIENT_PROMPT_BONUS, 10) || 15,
  },

  // Rate Limiting
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
  submitRateLimitPerMinute: parseInt(process.env.SUBMIT_RATE_LIMIT_PER_MINUTE, 10) || 10,
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 3600000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // Admin
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'ControlArena2024!',
  adminRegistrationCode: process.env.ADMIN_REGISTRATION_CODE || 'ARENA-ADMIN-2026',

  // CORS
  corsOrigins: process.env.CORS_ORIGINS || '*',

  // Static CDN — set to your Vercel deployment URL in production
  // e.g. https://ai-zone-static.vercel.app
  staticCdnUrl: (process.env.STATIC_CDN_URL || '').replace(/\/$/, ''),
};

module.exports = config;
