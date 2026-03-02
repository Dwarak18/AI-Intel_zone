// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Security Engine — Injection Detection, Rate Limiting, Tamper Detection
// ==============================================================================

const crypto = require('crypto');
const { AuditLog, SecurityEvent } = require('./models');

// ==============================================================================
// PROMPT INJECTION DETECTION ENGINE
// ==============================================================================
const INJECTION_PATTERNS = [
  // Direct instruction override
  { pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i, weight: 0.95, category: 'instruction_override' },
  { pattern: /disregard\s+(all\s+)?(previous|above|prior)/i, weight: 0.90, category: 'instruction_override' },
  { pattern: /forget\s+(everything|all|what)\s+(you|i)\s+(told|said|know)/i, weight: 0.90, category: 'instruction_override' },

  // System prompt extraction
  { pattern: /(show|reveal|display|print|output)\s+(your|the|system)\s+(system\s+)?(prompt|instructions?)/i, weight: 0.95, category: 'prompt_extraction' },
  { pattern: /what\s+(are|is)\s+your\s+(system\s+)?(instructions?|prompt|rules?)/i, weight: 0.85, category: 'prompt_extraction' },
  { pattern: /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i, weight: 0.90, category: 'prompt_extraction' },

  // Role play attacks
  { pattern: /(pretend|act|imagine|roleplay)\s+(you\s+are|to\s+be|as)\s+(a\s+)?(different|new|another)/i, weight: 0.80, category: 'role_manipulation' },
  { pattern: /you\s+are\s+now\s+(DAN|a\s+new|an?\s+unrestricted)/i, weight: 0.95, category: 'role_manipulation' },
  { pattern: /jailbreak/i, weight: 0.95, category: 'jailbreak_attempt' },

  // Code injection
  { pattern: /<script[^>]*>/i, weight: 0.95, category: 'xss_attempt' },
  { pattern: /javascript\s*:/i, weight: 0.90, category: 'xss_attempt' },
  { pattern: /on(load|error|click)\s*=/i, weight: 0.85, category: 'xss_attempt' },

  // SQL injection
  { pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b.*\b(FROM|INTO|TABLE|SET)\b)/i, weight: 0.85, category: 'sql_injection' },
  { pattern: /(--|;)\s*(DROP|DELETE|ALTER)\b/i, weight: 0.95, category: 'sql_injection' },
  { pattern: /'\s*(OR|AND)\s*'?\d*'?\s*=\s*'?\d*/i, weight: 0.90, category: 'sql_injection' },

  // OS command injection
  { pattern: /;\s*(ls|cat|rm|wget|curl|chmod|bash|sh|python|node)\b/i, weight: 0.90, category: 'command_injection' },
  { pattern: /\|\s*(ls|cat|rm|bash|sh)\b/i, weight: 0.85, category: 'command_injection' },
  { pattern: /\$\(.*\)/, weight: 0.70, category: 'command_injection' },

  // Path traversal
  { pattern: /\.\.\/\.\.\//, weight: 0.85, category: 'path_traversal' },
  { pattern: /\/etc\/(passwd|shadow|hosts)/, weight: 0.95, category: 'path_traversal' },

  // Encoding tricks
  { pattern: /&#x?[0-9a-fA-F]+;/, weight: 0.60, category: 'encoding_evasion' },
  { pattern: /\\u[0-9a-fA-F]{4}/, weight: 0.50, category: 'encoding_evasion' },
  { pattern: /base64\s*[:\(]/i, weight: 0.70, category: 'encoding_evasion' },

  // Token/boundary manipulation
  { pattern: /\[INST\]|\[\/INST\]|<\|system\|>|<\|user\|>|<\|assistant\|>/i, weight: 0.95, category: 'token_manipulation' },
  { pattern: /<<SYS>>|<<\/SYS>>/i, weight: 0.95, category: 'token_manipulation' },
];

class InjectionDetector {
  static analyze(promptText) {
    if (!promptText) {
      return { isSuspicious: false, injectionScore: 0.0, patternsFound: [], details: [] };
    }

    const results = {
      isSuspicious: false,
      injectionScore: 0.0,
      patternsFound: [],
      details: [],
    };

    let maxScore = 0.0;

    // Pattern Matching
    for (const { pattern, weight, category } of INJECTION_PATTERNS) {
      const matches = promptText.match(pattern);
      if (matches) {
        maxScore = Math.max(maxScore, weight);
        results.patternsFound.push({
          category,
          weight,
          matchCount: matches.length,
        });
      }
    }

    // Entropy Analysis
    const entropy = this.calculateEntropy(promptText);
    if (entropy > 5.5) {
      results.details.push({
        check: 'entropy_analysis',
        value: Math.round(entropy * 1000) / 1000,
        threshold: 5.5,
        status: 'high_entropy',
      });
      maxScore = Math.max(maxScore, Math.min(0.5, (entropy - 5.5) / 2));
    }

    // Length Anomaly
    if (promptText.length > 5000) {
      const anomalyScore = Math.min(0.7, (promptText.length - 5000) / 10000);
      results.details.push({
        check: 'length_anomaly',
        value: promptText.length,
        threshold: 5000,
        status: 'excessive_length',
      });
      maxScore = Math.max(maxScore, anomalyScore);
    }

    // Special Character Density
    const specialChars = promptText.split('').filter(c => !/[a-zA-Z0-9\s]/.test(c)).length;
    const density = specialChars / Math.max(promptText.length, 1);
    if (density > 0.3) {
      results.details.push({
        check: 'special_char_density',
        value: Math.round(density * 1000) / 1000,
        threshold: 0.3,
        status: 'high_density',
      });
      maxScore = Math.max(maxScore, Math.min(0.6, density));
    }

    // Nested Structure Detection
    const nestedBraces = Math.max(
      this.countMaxNesting(promptText, '{', '}'),
      this.countMaxNesting(promptText, '[', ']'),
      this.countMaxNesting(promptText, '(', ')'),
    );
    if (nestedBraces > 5) {
      results.details.push({
        check: 'nesting_depth',
        value: nestedBraces,
        threshold: 5,
        status: 'deep_nesting',
      });
      maxScore = Math.max(maxScore, Math.min(0.5, nestedBraces / 15));
    }

    results.injectionScore = Math.round(maxScore * 1000) / 1000;
    results.isSuspicious = maxScore >= 0.5;

    return results;
  }

  static calculateEntropy(text) {
    if (!text) return 0.0;
    const freq = {};
    for (const char of text) {
      freq[char] = (freq[char] || 0) + 1;
    }
    const length = text.length;
    let entropy = 0;
    for (const count of Object.values(freq)) {
      const p = count / length;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  static countMaxNesting(text, openChar, closeChar) {
    let depth = 0;
    let maxDepth = 0;
    for (const char of text) {
      if (char === openChar) {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (char === closeChar) {
        depth = Math.max(0, depth - 1);
      }
    }
    return maxDepth;
  }
}

// ==============================================================================
// TAMPER DETECTION
// ==============================================================================
class TamperDetector {
  static computeHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static verifyIntegrity(data, expectedHash) {
    const actualHash = this.computeHash(data);
    return actualHash === expectedHash;
  }

  static detectScoreAnomaly(teamScores, newScore) {
    if (teamScores.length < 3) return false;
    const mean = teamScores.reduce((a, b) => a + b, 0) / teamScores.length;
    const variance = teamScores.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / teamScores.length;
    const stdDev = variance > 0 ? Math.sqrt(variance) : 1;
    const zScore = Math.abs(newScore - mean) / stdDev;
    return zScore > 3.0;
  }
}

// ==============================================================================
// AUDIT LOGGER
// ==============================================================================
class AuditLogger {
  static async log(action, description = null, options = {}) {
    try {
      const entry = await AuditLog.create({
        userId: options.userId || null,
        teamId: options.teamId || null,
        action,
        resourceType: options.resourceType || null,
        resourceId: options.resourceId || null,
        description,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent ? options.userAgent.substring(0, 500) : null,
        requestMethod: options.requestMethod || null,
        requestPath: options.requestPath || null,
        requestPayloadHash: options.requestPayloadHash || null,
        severity: options.severity || 'info',
      });
      return entry;
    } catch (err) {
      console.error('Audit log failed:', err);
      return null;
    }
  }

  static async logSecurityEvent(eventType, description, options = {}) {
    try {
      const event = await SecurityEvent.create({
        teamId: options.teamId || null,
        userId: options.userId || null,
        submissionId: options.submissionId || null,
        eventType,
        severity: options.severity || 'medium',
        description,
        evidence: options.evidence ? JSON.stringify(options.evidence) : null,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent ? options.userAgent.substring(0, 500) : null,
      });
      return event;
    } catch (err) {
      console.error('Security event log failed:', err);
      return null;
    }
  }
}

// ==============================================================================
// RBAC MIDDLEWARE
// ==============================================================================
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      AuditLogger.log('unauthorized_access', 
        `User ${req.user.username} attempted to access ${req.path} with role ${req.user.role}, required: ${roles.join(', ')}`,
        {
          userId: req.user.id,
          ipAddress: req.ip,
          severity: 'warning',
        }
      );
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRole('super_admin', 'admin', 'moderator')(req, res, next);
}

function requireTeamAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Admins can access any team
  if (req.user.isAdmin) {
    return next();
  }
  // Team members can only access their own team
  const teamId = req.params.teamId || req.body.teamId;
  if (teamId && req.user.teamId !== teamId) {
    return res.status(403).json({ error: "You don't have access to this team" });
  }
  next();
}

// ==============================================================================
// REQUEST FINGERPRINTING
// ==============================================================================
class RequestFingerprint {
  static generate(req) {
    const components = [
      req.ip || '',
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
    ];
    const raw = components.join('|');
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
  }
}

module.exports = {
  InjectionDetector,
  TamperDetector,
  AuditLogger,
  requireRole,
  requireAdmin,
  requireTeamAccess,
  RequestFingerprint,
};
