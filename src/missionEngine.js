// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Mission Engine — Per-Mission Validation & Logic
// ==============================================================================

const FORMAT_ERROR = 'format';
const LOGIC_ERROR = 'logic';

// ==============================================================================
// MISSION RESULT
// ==============================================================================
class MissionResult {
  constructor() {
    this.passed = true;
    this.errors = [];
    this.warnings = [];
    this.logicScore = 1.0;
  }

  addFormatError(msg) {
    this.passed = false;
    this.errors.push({ msg, category: FORMAT_ERROR });
  }

  addLogicError(msg, penalty = 1.0) {
    this.passed = false;
    this.logicScore = Math.max(0.0, this.logicScore - penalty);
    this.errors.push({ msg, category: LOGIC_ERROR });
  }

  toDict() {
    return {
      passed: this.passed,
      logicScore: Math.round(this.logicScore * 10000) / 10000,
      errors: this.errors,
      warnings: this.warnings,
    };
  }
}

// ==============================================================================
// BASE MISSION
// ==============================================================================
class BaseMission {
  static MISSION_CODE = '';

  static META = {
    title: 'Mission',
    objective: 'Complete the mission.',
    outputFormatHint: 'Return ONLY valid JSON. No explanation. No markdown. No additional fields.',
    validExample: '{}',
    invalidExample: '{}',
  };

  static inputText() {
    return null;
  }

  static validate(parsed, missionDbObj) {
    return new MissionResult();
  }
}

// ==============================================================================
// MISSION 01 — JSON Identity Parser
// ==============================================================================
class Mission01JsonIdentity extends BaseMission {
  static MISSION_CODE = 'MISSION-01';

  static META = {
    title: 'JSON Identity Parser',
    objective: 'Return a JSON object that describes your team. All four fields are required; no extra fields allowed.',
    outputFormatHint: `Return ONLY valid JSON. No explanation. No markdown. No additional fields.

Required fields:
  team_name      — string   (your team's full name)
  team_code      — string   (your team code, e.g. TEAM-ALPHA-01)
  member_count   — integer  (number of members, 1–10)
  motto          — string   (a one-line team motto)`,
    validExample: JSON.stringify({
      team_name: 'Neural Knights',
      team_code: 'TEAM-ALPHA-01',
      member_count: 3,
      motto: 'Parse first, ask questions never.',
    }, null, 2),
    invalidExample: JSON.stringify({
      name: 'Neural Knights',
      code: 'ALPHA-01',
      members: 'three',
    }, null, 2),
  };

  static validate(parsed, missionDbObj) {
    const result = new MissionResult();
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      result.addFormatError('Response must be a JSON object, not an array or primitive.');
      return result;
    }

    // Extra keys
    const allowed = new Set(['team_name', 'team_code', 'member_count', 'motto']);
    const extra = Object.keys(parsed).filter(k => !allowed.has(k));
    if (extra.length > 0) {
      result.addFormatError(`Extra keys not allowed: ${JSON.stringify(extra.sort())}`);
    }

    // member_count range check
    const mc = parsed.member_count;
    if (typeof mc === 'number' && (mc < 1 || mc > 10)) {
      result.addLogicError(`member_count must be between 1 and 10 (got ${mc}).`, 0.5);
    }

    // motto must be non-empty
    const motto = parsed.motto || '';
    if (typeof motto === 'string' && motto.trim().length < 3) {
      result.addLogicError('motto is too short — write a real team motto.', 0.2);
    }

    return result;
  }
}

// ==============================================================================
// MISSION 02 — Sentiment Classifier
// ==============================================================================
class Mission02SentimentClassifier extends BaseMission {
  static MISSION_CODE = 'MISSION-02';

  static _INPUT = 'Despite the long delays and numerous technical difficulties, the team managed to deliver an impressive final result that exceeded all expectations.';

  static META = {
    title: 'Sentiment Classifier',
    objective: 'Classify the sentiment of the provided sentence. Return the exact text you were given, the sentiment label, a confidence score between 0 and 1, and a list of keywords.',
    outputFormatHint: `Return ONLY valid JSON. No explanation. No markdown. No additional fields.

Required fields:
  text        — string  (copy the input sentence exactly)
  sentiment   — string  MUST be one of: positive | negative | neutral
  confidence  — number  between 0.0 and 1.0
  keywords    — array   of strings extracted from the text

⚠️  'sentiment' MUST be exactly one of the three allowed values.`,
    validExample: JSON.stringify({
      text: Mission02SentimentClassifier._INPUT,
      sentiment: 'positive',
      confidence: 0.87,
      keywords: ['delays', 'technical difficulties', 'impressive', 'exceeded expectations'],
    }, null, 2),
    invalidExample: JSON.stringify({
      text: Mission02SentimentClassifier._INPUT,
      sentiment: 'mixed',
      confidence: 1.5,
      keywords: 'delays, result',
    }, null, 2),
  };

  static inputText() {
    return this._INPUT;
  }

  static validate(parsed, missionDbObj) {
    const result = new MissionResult();
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      result.addFormatError('Response must be a JSON object.');
      return result;
    }

    // Extra keys
    const allowed = new Set(['text', 'sentiment', 'confidence', 'keywords']);
    const extra = Object.keys(parsed).filter(k => !allowed.has(k));
    if (extra.length > 0) {
      result.addFormatError(`Extra keys not allowed: ${JSON.stringify(extra.sort())}`);
    }

    // Sentiment enum
    const sentiment = parsed.sentiment;
    if (sentiment !== undefined) {
      const validSentiments = new Set(['positive', 'negative', 'neutral']);
      if (!validSentiments.has(sentiment)) {
        result.addFormatError(`'sentiment' must be one of ${JSON.stringify([...validSentiments].sort())}, got '${sentiment}'.`);
      }
    }

    // Confidence range
    const confidence = parsed.confidence;
    if (confidence !== undefined) {
      if (typeof confidence !== 'number') {
        result.addFormatError(`'confidence' must be a number between 0 and 1, got ${typeof confidence}.`);
      } else if (confidence < 0.0 || confidence > 1.0) {
        result.addFormatError(`'confidence' must be between 0.0 and 1.0, got ${confidence}.`);
      }
    }

    // keywords must be array
    const keywords = parsed.keywords;
    if (keywords !== undefined && !Array.isArray(keywords)) {
      result.addFormatError(`'keywords' must be a JSON array, got ${typeof keywords}.`);
    } else if (Array.isArray(keywords) && keywords.length === 0) {
      result.addLogicError("'keywords' array is empty — extract relevant words.", 0.3);
    }

    // text should match the input
    const text = parsed.text || '';
    if (typeof text === 'string' && text.trim() && !text.includes(this._INPUT.split(' ')[0])) {
      result.addLogicError('The \'text\' field should contain the sentence provided in the mission.', 0.2);
    }

    return result;
  }
}

// ==============================================================================
// MISSION 03 — Data Structure Generator
// ==============================================================================
class Mission03DataStructure extends BaseMission {
  static MISSION_CODE = 'MISSION-03';

  static META = {
    title: 'Data Structure Generator',
    objective: 'Represent a binary tree node in JSON. The root node must have value=42 and depth=0. Left and right children are optional but must also be valid nodes if present.',
    outputFormatHint: `Return ONLY valid JSON. No explanation. No markdown. No additional fields.

Required fields:
  value   — integer  (the node value; root must be 42)
  depth   — integer  (0 for root, increments per level)
  left    — object | null  (a child node, or null)
  right   — object | null  (a child node, or null)

⚠️  depth must equal the nesting level. Root = 0, its children = 1, etc.`,
    validExample: JSON.stringify({
      value: 42,
      depth: 0,
      left: { value: 17, depth: 1, left: null, right: null },
      right: { value: 88, depth: 1, left: null, right: null },
    }, null, 2),
    invalidExample: JSON.stringify({
      val: 42,
      level: 0,
      left: 'none',
    }, null, 2),
  };

  static validate(parsed, missionDbObj) {
    const result = new MissionResult();
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      result.addFormatError('Response must be a JSON object.');
      return result;
    }

    // Root value must be 42
    const value = parsed.value;
    if (value !== undefined && value !== 42) {
      result.addLogicError(`Root node 'value' must be 42 (got ${value}).`, 0.5);
    }

    // Root depth must be 0
    const depth = parsed.depth;
    if (depth !== undefined && depth !== 0) {
      result.addLogicError(`Root 'depth' must be 0 (got ${depth}).`, 0.3);
    }

    // left/right must be object or null
    for (const side of ['left', 'right']) {
      const child = parsed[side];
      if (child !== null && child !== undefined && typeof child !== 'object') {
        result.addFormatError(`'${side}' must be a node object or null, got ${typeof child}.`);
      } else if (child && typeof child === 'object') {
        const childDepth = child.depth;
        if (childDepth !== 1) {
          result.addLogicError(`'${side}' child depth must be 1, got ${childDepth}.`, 0.2);
        }
      }
    }

    return result;
  }
}

// ==============================================================================
// MISSION 04 — API Response Simulator
// ==============================================================================
class Mission04ApiResponse extends BaseMission {
  static MISSION_CODE = 'MISSION-04';

  static UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  static ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  static VALID_CODES = new Set([400, 401, 403, 404, 408, 422, 429, 500, 502, 503, 504]);
  static VALID_TYPES = new Set([
    'BadRequest', 'Unauthorized', 'Forbidden', 'NotFound',
    'Timeout', 'UnprocessableEntity', 'TooManyRequests',
    'InternalServerError', 'BadGateway', 'ServiceUnavailable', 'GatewayTimeout',
  ]);

  static META = {
    title: 'API Response Simulator',
    objective: 'Generate a realistic HTTP error response JSON. Use a valid HTTP status code, a standard error_type, an ISO 8601 timestamp, and a UUID request_id.',
    outputFormatHint: `Return ONLY valid JSON. No explanation. No markdown. No additional fields.

Required fields:
  status_code  — integer   must be a valid HTTP error code (4xx or 5xx)
  error_type   — string    e.g. NotFound, Unauthorized, InternalServerError
  message      — string    a human-readable error description
  timestamp    — string    ISO 8601 format  (e.g. 2026-03-02T14:30:00Z)
  request_id   — string    UUID v4 format   (e.g. 550e8400-e29b-41d4-a716-446655440000)`,
    validExample: JSON.stringify({
      status_code: 404,
      error_type: 'NotFound',
      message: 'The requested resource could not be located.',
      timestamp: '2026-03-02T14:30:00Z',
      request_id: '550e8400-e29b-41d4-a716-446655440000',
    }, null, 2),
    invalidExample: JSON.stringify({
      status_code: 200,
      error_type: 'success',
      message: 'all good',
      timestamp: 'today at noon',
      request_id: 'abc123',
    }, null, 2),
  };

  static validate(parsed, missionDbObj) {
    const result = new MissionResult();
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      result.addFormatError('Response must be a JSON object.');
      return result;
    }

    // Extra keys
    const allowed = new Set(['status_code', 'error_type', 'message', 'timestamp', 'request_id']);
    const extra = Object.keys(parsed).filter(k => !allowed.has(k));
    if (extra.length > 0) {
      result.addFormatError(`Extra keys not allowed: ${JSON.stringify(extra.sort())}`);
    }

    // status_code
    const sc = parsed.status_code;
    if (typeof sc === 'number' && !this.VALID_CODES.has(sc)) {
      result.addLogicError(`status_code ${sc} is not a recognised HTTP error code.`, 0.4);
    }

    // error_type
    const et = parsed.error_type || '';
    if (et && !this.VALID_TYPES.has(et)) {
      result.addLogicError(`error_type '${et}' is not a standard type.`, 0.3);
    }

    // timestamp
    const ts = parsed.timestamp || '';
    if (ts && !this.ISO_RE.test(String(ts))) {
      result.addFormatError(`'timestamp' must be ISO 8601 format, got '${ts}'.`);
    }

    // request_id
    const rid = parsed.request_id || '';
    if (rid && !this.UUID_RE.test(String(rid))) {
      result.addFormatError(`'request_id' must be a UUID v4 string, got '${rid}'.`);
    }

    return result;
  }
}

// ==============================================================================
// MISSION 05 — Final Challenge
// ==============================================================================
class Mission05FinalChallenge extends BaseMission {
  static MISSION_CODE = 'MISSION-05';

  static META = {
    title: 'The Final Challenge',
    objective: 'Produce a complete competition summary for your team. List the mission codes you completed, your total score, your current rank, achievements earned, and a memorable final statement.',
    outputFormatHint: `Return ONLY valid JSON. No explanation. No markdown. No additional fields.

Required fields:
  team_name           — string  (your team name)
  missions_completed  — array   of strings (mission codes, e.g. ["MISSION-01"])
  total_score         — number  (your total competition score)
  rank                — integer (your current rank, 1 = first place)
  achievements        — array   of strings (achievement names)
  final_statement     — string  (20+ words — make it memorable)`,
    validExample: JSON.stringify({
      team_name: 'Neural Knights',
      missions_completed: ['MISSION-01', 'MISSION-02', 'MISSION-03'],
      total_score: 487.5,
      rank: 2,
      achievements: ['First Blood', 'Speed Demon', 'Efficient Prompt'],
      final_statement: 'We came to parse, we stayed to conquer — JSON shall never frighten us again.',
    }, null, 2),
    invalidExample: JSON.stringify({
      team: 'Neural Knights',
      completed_missions: 'MISSION-01, MISSION-02',
      score: -50,
      rank: 0,
      final_statement: 'done',
    }, null, 2),
  };

  static validate(parsed, missionDbObj) {
    const result = new MissionResult();
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      result.addFormatError('Response must be a JSON object.');
      return result;
    }

    // Extra keys
    const allowed = new Set(['team_name', 'missions_completed', 'total_score', 'rank', 'achievements', 'final_statement']);
    const extra = Object.keys(parsed).filter(k => !allowed.has(k));
    if (extra.length > 0) {
      result.addFormatError(`Extra keys not allowed: ${JSON.stringify(extra.sort())}`);
    }

    // missions_completed
    const mc = parsed.missions_completed;
    if (mc !== undefined && !Array.isArray(mc)) {
      result.addFormatError(`'missions_completed' must be a JSON array, got ${typeof mc}.`);
    } else if (Array.isArray(mc) && mc.length === 0) {
      result.addLogicError("'missions_completed' is empty — list the missions you completed.", 0.4);
    }

    // achievements
    const ach = parsed.achievements;
    if (ach !== undefined && !Array.isArray(ach)) {
      result.addFormatError(`'achievements' must be a JSON array, got ${typeof ach}.`);
    }

    // total_score
    const ts = parsed.total_score;
    if (typeof ts === 'number' && ts < 0) {
      result.addLogicError(`'total_score' cannot be negative, got ${ts}.`, 0.3);
    }

    // rank
    const rank = parsed.rank;
    if (typeof rank === 'number' && rank < 1) {
      result.addLogicError(`'rank' must be 1 or higher, got ${rank}.`, 0.2);
    }

    // final_statement
    const fs = parsed.final_statement || '';
    if (typeof fs === 'string' && fs.split(/\s+/).length < 20) {
      result.addLogicError(`'final_statement' must be at least 20 words (got ${fs.split(/\s+/).length}).`, 0.2);
    }

    return result;
  }
}

// ==============================================================================
// REGISTRY
// ==============================================================================
const MISSION_REGISTRY = {
  'MISSION-01': Mission01JsonIdentity,
  'MISSION-02': Mission02SentimentClassifier,
  'MISSION-03': Mission03DataStructure,
  'MISSION-04': Mission04ApiResponse,
  'MISSION-05': Mission05FinalChallenge,
};

function getMissionHandler(missionCode) {
  return MISSION_REGISTRY[missionCode] || BaseMission;
}

function runMissionValidation(parsed, missionDbObj) {
  const handler = getMissionHandler(missionDbObj.missionCode);
  try {
    const raw = typeof parsed === 'object' ? parsed : {};
    return handler.validate(raw, missionDbObj);
  } catch (exc) {
    const res = new MissionResult();
    res.addFormatError(`Mission validator internal error: ${exc.message}`);
    return res;
  }
}

module.exports = {
  MissionResult,
  BaseMission,
  Mission01JsonIdentity,
  Mission02SentimentClassifier,
  Mission03DataStructure,
  Mission04ApiResponse,
  Mission05FinalChallenge,
  MISSION_REGISTRY,
  getMissionHandler,
  runMissionValidation,
};
