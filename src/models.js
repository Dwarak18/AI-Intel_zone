// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Database Configuration & Sequelize Models
// ==============================================================================

const { Sequelize, DataTypes, Model } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const config = require('./config');
const path = require('path');
const fs = require('fs');

// Parse database URL
let sequelize;
const dbUrl = config.databaseUrl;

if (dbUrl.startsWith('sqlite:')) {
  const dbPath = dbUrl.replace('sqlite:', '');
  const dbDir = path.dirname(dbPath);
  if (dbDir && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath.startsWith('.') ? path.join(process.cwd(), dbPath) : dbPath,
    logging: config.env === 'development' ? console.log : false,
  });
} else {
  sequelize = new Sequelize(dbUrl, {
    logging: config.env === 'development' ? console.log : false,
    pool: {
      max: 15,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
}

// ==============================================================================
// USER MODEL
// ==============================================================================
class User extends Model {
  async checkPassword(password) {
    return bcrypt.compare(password, this.passwordHash);
  }

  async setPassword(password) {
    this.passwordHash = await bcrypt.hash(password, 12);
  }

  get isAdmin() {
    return ['super_admin', 'admin', 'moderator'].includes(this.role);
  }

  get isModerator() {
    return ['super_admin', 'admin', 'moderator'].includes(this.role);
  }

  toJSON() {
    const values = { ...this.get() };
    delete values.passwordHash;
    return values;
  }

  toDict(includeSensitive = false) {
    const data = {
      id: this.id,
      username: this.username,
      email: this.email,
      role: this.role,
      isActive: this.isActive,
      lastLogin: this.lastLogin ? this.lastLogin.toISOString() : null,
      loginCount: this.loginCount,
      createdAt: this.createdAt.toISOString(),
    };
    if (includeSensitive) {
      data.lastLoginIp = this.lastLoginIp;
    }
    return data;
  }
}

User.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  username: {
    type: DataTypes.STRING(80),
    unique: true,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(120),
    unique: true,
    allowNull: false,
  },
  passwordHash: {
    type: DataTypes.STRING(256),
    allowNull: false,
    field: 'password_hash',
  },
  role: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'team_member',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  lastLogin: {
    type: DataTypes.DATE,
    field: 'last_login',
  },
  lastLoginIp: {
    type: DataTypes.STRING(45),
    field: 'last_login_ip',
  },
  loginCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'login_count',
  },
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  underscored: true,
});

// ==============================================================================
// TEAM MODEL
// ==============================================================================
class Team extends Model {
  get validationRate() {
    if (this.totalSubmissions === 0) return 0;
    return (this.successfulValidations / this.totalSubmissions) * 100;
  }

  toDict(includeMembers = false) {
    const data = {
      id: this.id,
      teamCode: this.teamCode,
      name: this.name,
      institution: this.institution,
      status: this.status,
      avatarColor: this.avatarColor,
      totalScore: Math.round(this.totalScore * 100) / 100,
      missionsCompleted: this.missionsCompleted,
      totalSubmissions: this.totalSubmissions,
      successfulValidations: this.successfulValidations,
      failedValidations: this.failedValidations,
      validationRate: Math.round(this.validationRate * 10) / 10,
      currentRank: this.currentRank,
      bonusPoints: Math.round(this.bonusPoints * 100) / 100,
      errorRate: Math.round(this.errorRate * 10) / 10,
      hallucinationCount: this.hallucinationCount,
      healthScore: Math.round(this.healthScore * 10) / 10,
      lastActivityAt: this.lastActivityAt ? this.lastActivityAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
    };
    return data;
  }

  toLeaderboardDict() {
    return {
      rank: this.currentRank,
      teamCode: this.teamCode,
      name: this.name,
      totalScore: Math.round(this.totalScore * 100) / 100,
      missionsCompleted: this.missionsCompleted,
      validationRate: Math.round(this.validationRate * 10) / 10,
      bonusPoints: Math.round(this.bonusPoints * 100) / 100,
      totalSubmissions: this.totalSubmissions,
      avatarColor: this.avatarColor,
      status: this.status,
    };
  }
}

Team.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  teamCode: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false,
    field: 'team_code',
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  institution: {
    type: DataTypes.STRING(200),
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'active',
  },
  disqualificationReason: {
    type: DataTypes.TEXT,
    field: 'disqualification_reason',
  },
  avatarColor: {
    type: DataTypes.STRING(7),
    defaultValue: '#3B82F6',
    field: 'avatar_color',
  },
  totalScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'total_score',
  },
  missionsCompleted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'missions_completed',
  },
  totalSubmissions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_submissions',
  },
  successfulValidations: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'successful_validations',
  },
  failedValidations: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'failed_validations',
  },
  currentRank: {
    type: DataTypes.INTEGER,
    field: 'current_rank',
  },
  bonusPoints: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'bonus_points',
  },
  errorRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'error_rate',
  },
  hallucinationCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'hallucination_count',
  },
  avgResponseTime: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'avg_response_time',
  },
  healthScore: {
    type: DataTypes.FLOAT,
    defaultValue: 100.0,
    field: 'health_score',
  },
  lastActivityAt: {
    type: DataTypes.DATE,
    field: 'last_activity_at',
  },
}, {
  sequelize,
  modelName: 'Team',
  tableName: 'teams',
  underscored: true,
});

// ==============================================================================
// TEAM MEMBER MODEL
// ==============================================================================
class TeamMember extends Model {
  toDict() {
    return {
      id: this.id,
      userId: this.userId,
      roleInTeam: this.roleInTeam,
      isActive: this.isActive,
      submissionsCount: this.submissionsCount,
      participationScore: Math.round(this.participationScore * 10) / 10,
      joinedAt: this.joinedAt ? this.joinedAt.toISOString() : null,
      lastActiveAt: this.lastActiveAt ? this.lastActiveAt.toISOString() : null,
    };
  }
}

TeamMember.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  teamId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'team_id',
  },
  userId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'user_id',
  },
  roleInTeam: {
    type: DataTypes.STRING(20),
    defaultValue: 'member',
    field: 'role_in_team',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  submissionsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'submissions_count',
  },
  participationScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'participation_score',
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'joined_at',
  },
  lastActiveAt: {
    type: DataTypes.DATE,
    field: 'last_active_at',
  },
}, {
  sequelize,
  modelName: 'TeamMember',
  tableName: 'team_members',
  underscored: true,
  indexes: [
    { unique: true, fields: ['team_id', 'user_id'] },
  ],
});

// ==============================================================================
// MISSION MODEL
// ==============================================================================
class Mission extends Model {
  getSchema() {
    if (this.expectedSchema) {
      try {
        return JSON.parse(this.expectedSchema);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  getEnumConstraints() {
    if (this.enumConstraints) {
      try {
        return JSON.parse(this.enumConstraints);
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  toDict(includeSchema = false) {
    const data = {
      id: this.id,
      missionCode: this.missionCode,
      title: this.title,
      description: this.description,
      objective: this.objective,
      inputText: this.inputText,
      outputFormatHint: this.outputFormatHint,
      difficulty: this.difficulty,
      category: this.category,
      maxPoints: this.maxPoints,
      timeLimitSeconds: this.timeLimitSeconds,
      maxRetries: this.maxRetries,
      isActive: this.isActive,
      isVisible: this.isVisible,
      orderIndex: this.orderIndex,
      totalAttempts: this.totalAttempts,
      totalCompletions: this.totalCompletions,
      firstBloodTeamId: this.firstBloodTeamId,
    };
    if (includeSchema) {
      data.expectedSchema = this.getSchema();
      data.expectedFields = this.expectedFields ? JSON.parse(this.expectedFields) : [];
      data.validExample = this.validExample;
      data.invalidExample = this.invalidExample;
      data.enumConstraints = this.getEnumConstraints();
    }
    return data;
  }
}

Mission.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  missionCode: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false,
    field: 'mission_code',
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  difficulty: {
    type: DataTypes.STRING(20),
    defaultValue: 'medium',
  },
  category: {
    type: DataTypes.STRING(50),
  },
  maxPoints: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 100.0,
    field: 'max_points',
  },
  timeLimitSeconds: {
    type: DataTypes.INTEGER,
    defaultValue: 600,
    field: 'time_limit_seconds',
  },
  maxRetries: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
    field: 'max_retries',
  },
  objective: {
    type: DataTypes.TEXT,
  },
  inputText: {
    type: DataTypes.TEXT,
    field: 'input_text',
  },
  outputFormatHint: {
    type: DataTypes.TEXT,
    field: 'output_format_hint',
  },
  validExample: {
    type: DataTypes.TEXT,
    field: 'valid_example',
  },
  invalidExample: {
    type: DataTypes.TEXT,
    field: 'invalid_example',
  },
  expectedSchema: {
    type: DataTypes.TEXT,
    field: 'expected_schema',
  },
  expectedFields: {
    type: DataTypes.TEXT,
    field: 'expected_fields',
  },
  validationRegex: {
    type: DataTypes.TEXT,
    field: 'validation_regex',
  },
  enumConstraints: {
    type: DataTypes.TEXT,
    field: 'enum_constraints',
  },
  sampleResponse: {
    type: DataTypes.TEXT,
    field: 'sample_response',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  isVisible: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_visible',
  },
  unlockAfterMission: {
    type: DataTypes.STRING(36),
    field: 'unlock_after_mission',
  },
  orderIndex: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'order_index',
  },
  firstBloodTeamId: {
    type: DataTypes.STRING(36),
    field: 'first_blood_team_id',
  },
  firstBloodAt: {
    type: DataTypes.DATE,
    field: 'first_blood_at',
  },
  totalAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_attempts',
  },
  totalCompletions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_completions',
  },
  avgCompletionTime: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'avg_completion_time',
  },
  startsAt: {
    type: DataTypes.DATE,
    field: 'starts_at',
  },
  endsAt: {
    type: DataTypes.DATE,
    field: 'ends_at',
  },
}, {
  sequelize,
  modelName: 'Mission',
  tableName: 'missions',
  underscored: true,
});

// ==============================================================================
// SUBMISSION MODEL
// ==============================================================================
class Submission extends Model {
  toDict() {
    let validationErrors = [];
    try {
      validationErrors = this.validationErrors ? JSON.parse(this.validationErrors) : [];
    } catch (e) {
      validationErrors = [];
    }
    return {
      id: this.id,
      teamId: this.teamId,
      missionId: this.missionId,
      attemptNumber: this.attemptNumber,
      promptText: this.promptText,
      aiRawResponse: this.aiRawResponse,
      validationStatus: this.validationStatus,
      jsonValid: this.jsonValid,
      schemaValid: this.schemaValid,
      typeCheckValid: this.typeCheckValid,
      regexValid: this.regexValid,
      fieldCountValid: this.fieldCountValid,
      validationErrors,
      accuracyScore: Math.round(this.accuracyScore * 100) / 100,
      speedScore: Math.round(this.speedScore * 100) / 100,
      confidenceScore: Math.round(this.confidenceScore * 100) / 100,
      totalScore: Math.round(this.totalScore * 100) / 100,
      bonusAwarded: Math.round(this.bonusAwarded * 100) / 100,
      bonusType: this.bonusType,
      responseTimeMs: this.responseTimeMs,
      isFlagged: this.isFlagged,
      flagReason: this.flagReason,
      injectionDetected: this.injectionDetected,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

Submission.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  teamId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'team_id',
  },
  missionId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'mission_id',
  },
  submittedBy: {
    type: DataTypes.STRING(36),
    field: 'submitted_by',
  },
  attemptNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'attempt_number',
  },
  promptText: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'prompt_text',
  },
  aiRawResponse: {
    type: DataTypes.TEXT,
    field: 'ai_raw_response',
  },
  parsedResponse: {
    type: DataTypes.TEXT,
    field: 'parsed_response',
  },
  validationStatus: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    field: 'validation_status',
  },
  jsonValid: {
    type: DataTypes.BOOLEAN,
    field: 'json_valid',
  },
  schemaValid: {
    type: DataTypes.BOOLEAN,
    field: 'schema_valid',
  },
  typeCheckValid: {
    type: DataTypes.BOOLEAN,
    field: 'type_check_valid',
  },
  regexValid: {
    type: DataTypes.BOOLEAN,
    field: 'regex_valid',
  },
  fieldCountValid: {
    type: DataTypes.BOOLEAN,
    field: 'field_count_valid',
  },
  validationErrors: {
    type: DataTypes.TEXT,
    field: 'validation_errors',
  },
  accuracyScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'accuracy_score',
  },
  speedScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'speed_score',
  },
  validationScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'validation_score',
  },
  confidenceScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'confidence_score',
  },
  totalScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'total_score',
  },
  bonusAwarded: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'bonus_awarded',
  },
  bonusType: {
    type: DataTypes.STRING(50),
    field: 'bonus_type',
  },
  responseTimeMs: {
    type: DataTypes.INTEGER,
    field: 'response_time_ms',
  },
  promptLength: {
    type: DataTypes.INTEGER,
    field: 'prompt_length',
  },
  responseLength: {
    type: DataTypes.INTEGER,
    field: 'response_length',
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    field: 'ip_address',
  },
  userAgent: {
    type: DataTypes.STRING(500),
    field: 'user_agent',
  },
  isFlagged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_flagged',
  },
  flagReason: {
    type: DataTypes.STRING(200),
    field: 'flag_reason',
  },
  injectionDetected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'injection_detected',
  },
  isHallucinated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_hallucinated',
  },
  validatedAt: {
    type: DataTypes.DATE,
    field: 'validated_at',
  },
}, {
  sequelize,
  modelName: 'Submission',
  tableName: 'submissions',
  underscored: true,
  indexes: [
    { fields: ['team_id', 'mission_id'] },
    { fields: ['created_at'] },
  ],
});

// ==============================================================================
// AI LOG MODEL
// ==============================================================================
class AILog extends Model {
  toDict() {
    let errorDetails = null;
    try {
      errorDetails = this.errorDetails ? JSON.parse(this.errorDetails) : null;
    } catch (e) { }
    return {
      id: this.id,
      teamId: this.teamId,
      submissionId: this.submissionId,
      promptText: this.promptText,
      aiModelUsed: this.aiModelUsed,
      aiRawOutput: this.aiRawOutput,
      parseResult: this.parseResult,
      validationResult: this.validationResult,
      errorDetails,
      rejected: this.rejected,
      rejectionReason: this.rejectionReason,
      retryAttempt: this.retryAttempt,
      confidenceScore: this.confidenceScore,
      hallucinationProbability: this.hallucinationProbability,
      injectionScore: this.injectionScore,
      responseLatencyMs: this.responseLatencyMs,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

AILog.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  teamId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'team_id',
  },
  submissionId: {
    type: DataTypes.STRING(36),
    field: 'submission_id',
  },
  userId: {
    type: DataTypes.STRING(36),
    field: 'user_id',
  },
  promptText: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'prompt_text',
  },
  systemPromptUsed: {
    type: DataTypes.TEXT,
    field: 'system_prompt_used',
  },
  aiModelUsed: {
    type: DataTypes.STRING(50),
    field: 'ai_model_used',
  },
  aiRawOutput: {
    type: DataTypes.TEXT,
    field: 'ai_raw_output',
  },
  aiParsedOutput: {
    type: DataTypes.TEXT,
    field: 'ai_parsed_output',
  },
  parseResult: {
    type: DataTypes.STRING(20),
    field: 'parse_result',
  },
  validationResult: {
    type: DataTypes.STRING(20),
    field: 'validation_result',
  },
  errorDetails: {
    type: DataTypes.TEXT,
    field: 'error_details',
  },
  rejected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  rejectionReason: {
    type: DataTypes.STRING(500),
    field: 'rejection_reason',
  },
  retryAttempt: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'retry_attempt',
  },
  tokenCountPrompt: {
    type: DataTypes.INTEGER,
    field: 'token_count_prompt',
  },
  tokenCountResponse: {
    type: DataTypes.INTEGER,
    field: 'token_count_response',
  },
  responseLatencyMs: {
    type: DataTypes.INTEGER,
    field: 'response_latency_ms',
  },
  confidenceScore: {
    type: DataTypes.FLOAT,
    field: 'confidence_score',
  },
  hallucinationProbability: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'hallucination_probability',
  },
  injectionScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'injection_score',
  },
  suspiciousPatterns: {
    type: DataTypes.TEXT,
    field: 'suspicious_patterns',
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    field: 'ip_address',
  },
}, {
  sequelize,
  modelName: 'AILog',
  tableName: 'ai_logs',
  underscored: true,
  indexes: [
    { fields: ['team_id', 'created_at'] },
  ],
});

// ==============================================================================
// AUDIT LOG MODEL
// ==============================================================================
class AuditLog extends Model {
  toDict() {
    return {
      id: this.id,
      userId: this.userId,
      teamId: this.teamId,
      action: this.action,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      description: this.description,
      ipAddress: this.ipAddress,
      severity: this.severity,
      responseStatus: this.responseStatus,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

AuditLog.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  userId: {
    type: DataTypes.STRING(36),
    field: 'user_id',
  },
  teamId: {
    type: DataTypes.STRING(36),
    field: 'team_id',
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  resourceType: {
    type: DataTypes.STRING(50),
    field: 'resource_type',
  },
  resourceId: {
    type: DataTypes.STRING(36),
    field: 'resource_id',
  },
  description: {
    type: DataTypes.TEXT,
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    field: 'ip_address',
  },
  userAgent: {
    type: DataTypes.STRING(500),
    field: 'user_agent',
  },
  requestMethod: {
    type: DataTypes.STRING(10),
    field: 'request_method',
  },
  requestPath: {
    type: DataTypes.STRING(500),
    field: 'request_path',
  },
  requestPayloadHash: {
    type: DataTypes.STRING(64),
    field: 'request_payload_hash',
  },
  responseStatus: {
    type: DataTypes.INTEGER,
    field: 'response_status',
  },
  severity: {
    type: DataTypes.STRING(20),
    defaultValue: 'info',
  },
}, {
  sequelize,
  modelName: 'AuditLog',
  tableName: 'audit_logs',
  underscored: true,
  indexes: [
    { fields: ['action', 'created_at'] },
  ],
});

// ==============================================================================
// SECURITY EVENT MODEL
// ==============================================================================
class SecurityEvent extends Model {
  toDict() {
    let evidence = null;
    try {
      evidence = this.evidence ? JSON.parse(this.evidence) : null;
    } catch (e) { }
    return {
      id: this.id,
      teamId: this.teamId,
      userId: this.userId,
      eventType: this.eventType,
      severity: this.severity,
      description: this.description,
      evidence,
      ipAddress: this.ipAddress,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

SecurityEvent.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  teamId: {
    type: DataTypes.STRING(36),
    field: 'team_id',
  },
  userId: {
    type: DataTypes.STRING(36),
    field: 'user_id',
  },
  submissionId: {
    type: DataTypes.STRING(36),
    field: 'submission_id',
  },
  eventType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'event_type',
  },
  severity: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'medium',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  evidence: {
    type: DataTypes.TEXT,
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    field: 'ip_address',
  },
  userAgent: {
    type: DataTypes.STRING(500),
    field: 'user_agent',
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'open',
  },
  resolvedBy: {
    type: DataTypes.STRING(36),
    field: 'resolved_by',
  },
  resolvedAt: {
    type: DataTypes.DATE,
    field: 'resolved_at',
  },
  resolutionNotes: {
    type: DataTypes.TEXT,
    field: 'resolution_notes',
  },
}, {
  sequelize,
  modelName: 'SecurityEvent',
  tableName: 'security_events',
  underscored: true,
});

// ==============================================================================
// ACHIEVEMENT MODEL
// ==============================================================================
class Achievement extends Model {
  toDict() {
    return {
      id: this.id,
      teamId: this.teamId,
      achievementType: this.achievementType,
      title: this.title,
      description: this.description,
      icon: this.icon,
      pointsAwarded: this.pointsAwarded,
      awardedAt: this.awardedAt ? this.awardedAt.toISOString() : new Date().toISOString(),
    };
  }
}

Achievement.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  teamId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'team_id',
  },
  achievementType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'achievement_type',
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(500),
  },
  icon: {
    type: DataTypes.STRING(10),
  },
  pointsAwarded: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    field: 'points_awarded',
  },
  missionId: {
    type: DataTypes.STRING(36),
    field: 'mission_id',
  },
  awardedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'awarded_at',
  },
}, {
  sequelize,
  modelName: 'Achievement',
  tableName: 'achievements',
  underscored: true,
});

// ==============================================================================
// SCORE OVERRIDE MODEL
// ==============================================================================
class ScoreOverride extends Model {
  toDict() {
    return {
      id: this.id,
      teamId: this.teamId,
      adminId: this.adminId,
      previousScore: this.previousScore,
      newScore: this.newScore,
      reason: this.reason,
      overrideType: this.overrideType,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

ScoreOverride.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  teamId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'team_id',
  },
  adminId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'admin_id',
  },
  missionId: {
    type: DataTypes.STRING(36),
    field: 'mission_id',
  },
  previousScore: {
    type: DataTypes.FLOAT,
    allowNull: false,
    field: 'previous_score',
  },
  newScore: {
    type: DataTypes.FLOAT,
    allowNull: false,
    field: 'new_score',
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  overrideType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'override_type',
  },
}, {
  sequelize,
  modelName: 'ScoreOverride',
  tableName: 'score_overrides',
  underscored: true,
});

// ==============================================================================
// LEADERBOARD CACHE MODEL
// ==============================================================================
class LeaderboardCache extends Model {
  toDict() {
    return {
      teamId: this.teamId,
      rank: this.rank,
      totalScore: this.totalScore,
      bonusPoints: this.bonusPoints,
      missionsCompleted: this.missionsCompleted,
      totalSubmissions: this.totalSubmissions,
      validationRate: this.validationRate,
      healthScore: this.healthScore,
      snapshotAt: this.snapshotAt ? this.snapshotAt.toISOString() : null,
    };
  }
}

LeaderboardCache.init({
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4(),
  },
  teamId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'team_id',
  },
  rank: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  totalScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    field: 'total_score',
  },
  bonusPoints: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    field: 'bonus_points',
  },
  missionsCompleted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'missions_completed',
  },
  totalSubmissions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_submissions',
  },
  validationRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    field: 'validation_rate',
  },
  healthScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    field: 'health_score',
  },
  firstValidAt: {
    type: DataTypes.DATE,
    field: 'first_valid_at',
  },
  snapshotAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'snapshot_at',
  },
}, {
  sequelize,
  modelName: 'LeaderboardCache',
  tableName: 'leaderboard_cache',
  underscored: true,
});

// ==============================================================================
// ASSOCIATIONS
// ==============================================================================
User.hasMany(TeamMember, { foreignKey: 'userId', as: 'teamMemberships' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });

Team.hasMany(TeamMember, { foreignKey: 'teamId', as: 'members' });
Team.hasMany(Submission, { foreignKey: 'teamId', as: 'submissions' });
Team.hasMany(AILog, { foreignKey: 'teamId', as: 'aiLogs' });
Team.hasMany(Achievement, { foreignKey: 'teamId', as: 'achievements' });
Team.hasMany(ScoreOverride, { foreignKey: 'teamId', as: 'scoreOverrides' });

TeamMember.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });
TeamMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Mission.hasMany(Submission, { foreignKey: 'missionId', as: 'submissions' });

Submission.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });
Submission.belongsTo(Mission, { foreignKey: 'missionId', as: 'mission' });

AILog.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Achievement.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

ScoreOverride.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

LeaderboardCache.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

// ==============================================================================
// EXPORTS
// ==============================================================================
module.exports = {
  sequelize,
  User,
  Team,
  TeamMember,
  Mission,
  Submission,
  AILog,
  AuditLog,
  SecurityEvent,
  Achievement,
  ScoreOverride,
  LeaderboardCache,
};
