// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Validation Engine — Multi-stage AI Response Validation
// ==============================================================================

const Validator = require('jsonschema').Validator;

// ==============================================================================
// VALIDATION RESULT
// ==============================================================================
class ValidationResult {
  constructor() {
    this.jsonValid = false;
    this.schemaValid = false;
    this.typeCheckValid = false;
    this.regexValid = false;
    this.fieldCountValid = false;
    this.confidenceScore = 0.0;
    this.parsedData = null;
    this.errors = [];
    this.categorizedErrors = [];
    this.warnings = [];
    this.stageResults = {};
  }

  addError(msg, category = 'format') {
    this.errors.push(msg);
    this.categorizedErrors.push({ msg, category });
  }

  get isValid() {
    return this.jsonValid && this.schemaValid && this.typeCheckValid && this.fieldCountValid;
  }

  get overallStatus() {
    if (this.isValid) return 'valid';
    if (this.jsonValid) return 'invalid';
    return 'error';
  }

  get primaryErrorCategory() {
    if (!this.categorizedErrors.length) return null;
    const cats = this.categorizedErrors.map(e => e.category);
    if (cats.includes('format')) return 'format';
    return 'logic';
  }

  get accuracyPercentage() {
    const stages = [this.jsonValid, this.schemaValid, this.typeCheckValid, this.regexValid, this.fieldCountValid];
    const passed = stages.filter(s => s).length;
    return (passed / stages.length) * 100;
  }

  toDict() {
    return {
      isValid: this.isValid,
      overallStatus: this.overallStatus,
      jsonValid: this.jsonValid,
      schemaValid: this.schemaValid,
      typeCheckValid: this.typeCheckValid,
      regexValid: this.regexValid,
      fieldCountValid: this.fieldCountValid,
      confidenceScore: Math.round(this.confidenceScore * 10000) / 10000,
      accuracyPercentage: Math.round(this.accuracyPercentage * 10) / 10,
      errors: this.errors,
      categorizedErrors: this.categorizedErrors,
      warnings: this.warnings,
      stageResults: this.stageResults,
    };
  }

  toParticipantDict() {
    if (this.isValid) {
      return {
        status: 'valid',
        errorCategory: null,
        feedback: '✅ Response is valid.',
        errors: [],
        warnings: this.warnings,
        confidence: Math.round(this.confidenceScore * 1000) / 1000,
      };
    }

    const cat = this.primaryErrorCategory;
    const humanErrors = this.categorizedErrors.map(e => e.msg);

    let feedback;
    if (!this.jsonValid) {
      feedback = '❌ FORMAT ERROR — Could not parse your response as JSON. Check your syntax.';
    } else if (cat === 'format') {
      feedback = '❌ FORMAT ERROR — JSON parsed but structure is wrong (wrong keys, types, or extra fields).';
    } else {
      feedback = '⚠️ LOGIC ERROR — JSON structure is correct but values are wrong or out of range.';
    }

    return {
      status: this.overallStatus,
      errorCategory: cat || 'format',
      feedback,
      errors: humanErrors,
      warnings: this.warnings,
      confidence: Math.round(this.confidenceScore * 1000) / 1000,
    };
  }
}

// ==============================================================================
// VALIDATION ENGINE
// ==============================================================================
class ValidationEngine {
  static validate(rawResponse, schema = null, expectedFields = null, regexPatterns = null, strictMode = true) {
    const result = new ValidationResult();

    // Stage 1: JSON Parse
    const parsed = this.stageJsonParse(rawResponse, result);
    if (parsed === null) return result;

    // Stage 2: Schema Validation
    if (schema) {
      this.stageSchemaValidation(parsed, schema, result);
    } else {
      result.schemaValid = true;
      result.stageResults.schema = { status: 'skipped', reason: 'no schema provided' };
    }

    // Stage 3: Type Enforcement
    if (schema && schema.properties) {
      this.stageTypeEnforcement(parsed, schema, result);
    } else {
      result.typeCheckValid = true;
      result.stageResults.typeCheck = { status: 'skipped' };
    }

    // Stage 4: Field Count Check
    this.stageFieldCount(parsed, expectedFields, strictMode, result);

    // Stage 5: Regex Validation
    if (regexPatterns) {
      this.stageRegexValidation(parsed, regexPatterns, result);
    } else {
      result.regexValid = true;
      result.stageResults.regex = { status: 'skipped', reason: 'no patterns provided' };
    }

    // Stage 6: Confidence Scoring
    this.stageConfidenceScoring(parsed, schema, expectedFields, result);

    return result;
  }

  static stageJsonParse(rawResponse, result) {
    const stage = { status: 'failed', attempts: [] };

    // Attempt 1: Direct parse
    try {
      const parsed = JSON.parse(rawResponse);
      result.jsonValid = true;
      result.parsedData = parsed;
      stage.status = 'success';
      stage.method = 'direct_parse';
      result.stageResults.jsonParse = stage;
      return parsed;
    } catch (e) {
      stage.attempts.push({ method: 'direct', error: e.message });
    }

    // Attempt 2: Extract JSON from markdown code blocks
    const jsonMatch = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        result.jsonValid = true;
        result.parsedData = parsed;
        stage.status = 'success';
        stage.method = 'markdown_extraction';
        result.warnings.push('JSON was extracted from markdown code block');
        result.stageResults.jsonParse = stage;
        return parsed;
      } catch (e) {
        stage.attempts.push({ method: 'markdown', error: e.message });
      }
    }

    // Attempt 3: Find JSON-like structure with braces
    const braceMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        const parsed = JSON.parse(braceMatch[0]);
        result.jsonValid = true;
        result.parsedData = parsed;
        stage.status = 'success';
        stage.method = 'brace_extraction';
        result.warnings.push('JSON was extracted from surrounding text');
        result.stageResults.jsonParse = stage;
        return parsed;
      } catch (e) {
        stage.attempts.push({ method: 'brace_extract', error: e.message });
      }
    }

    // Attempt 4: Find JSON array
    const bracketMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (bracketMatch) {
      try {
        const parsed = JSON.parse(bracketMatch[0]);
        result.jsonValid = true;
        result.parsedData = parsed;
        stage.status = 'success';
        stage.method = 'array_extraction';
        result.warnings.push('JSON array was extracted from surrounding text');
        result.stageResults.jsonParse = stage;
        return parsed;
      } catch (e) {
        stage.attempts.push({ method: 'array_extract', error: e.message });
      }
    }

    result.errors.push('Failed to parse response as valid JSON after 4 extraction attempts');
    result.stageResults.jsonParse = stage;
    return null;
  }

  static stageSchemaValidation(data, schema, result) {
    const stage = { status: 'failed', errors: [] };
    const validator = new Validator();

    try {
      const validationResult = validator.validate(data, schema);
      if (validationResult.valid) {
        result.schemaValid = true;
        stage.status = 'success';
      } else {
        for (const error of validationResult.errors) {
          result.addError(`Schema error: ${error.message}`, 'format');
          stage.errors.push({
            path: error.property,
            message: error.message,
            validator: error.name,
          });
        }
      }
    } catch (e) {
      result.addError(`Schema validation exception: ${e.message}`, 'format');
      stage.errors.push({ message: e.message });
    }

    result.stageResults.schema = stage;
  }

  static stageTypeEnforcement(data, schema, result) {
    if (typeof data !== 'object' || Array.isArray(data)) {
      result.typeCheckValid = true;
      result.stageResults.typeCheck = { status: 'skipped', reason: 'data not a dict' };
      return;
    }

    const stage = { status: 'success', checked: 0, failed: 0, details: [] };
    const properties = schema.properties || {};

    const typeMap = {
      string: 'string',
      integer: 'number',
      number: 'number',
      boolean: 'boolean',
      array: 'object',
      object: 'object',
    };

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      if (!(fieldName in data)) continue;

      stage.checked++;
      const expectedType = fieldSchema.type;
      const actualValue = data[fieldName];

      if (expectedType && typeMap[expectedType]) {
        const expectedJs = typeMap[expectedType];
        const actualJs = typeof actualValue;

        let isValid = actualJs === expectedJs;
        if (expectedType === 'array' && !Array.isArray(actualValue)) isValid = false;
        if (expectedType === 'integer' && !Number.isInteger(actualValue)) isValid = false;

        if (!isValid && actualValue !== null) {
          stage.failed++;
          stage.details.push({
            field: fieldName,
            expected: expectedType,
            actual: typeof actualValue,
            valuePreview: String(actualValue).substring(0, 100),
          });
          result.addError(
            `Type mismatch for '${fieldName}': expected ${expectedType}, got ${typeof actualValue}`,
            'format'
          );
        }
      }
    }

    if (stage.failed > 0) {
      stage.status = 'failed';
      result.typeCheckValid = false;
    } else {
      result.typeCheckValid = true;
    }

    result.stageResults.typeCheck = stage;
  }

  static stageFieldCount(data, expectedFields, strictMode, result) {
    if (typeof data !== 'object' || Array.isArray(data)) {
      result.fieldCountValid = true;
      result.stageResults.fieldCount = { status: 'skipped', reason: 'data not a dict' };
      return;
    }

    const stage = {
      status: 'success',
      actualCount: Object.keys(data).length,
      expectedFields: expectedFields || [],
      missing: [],
      extra: [],
    };

    if (expectedFields) {
      const actualFields = new Set(Object.keys(data));
      const expectedSet = new Set(expectedFields);

      stage.missing = expectedFields.filter(f => !actualFields.has(f));
      stage.extra = [...actualFields].filter(f => !expectedSet.has(f));

      if (stage.missing.length > 0) {
        result.addError(`Missing required fields: ${JSON.stringify(stage.missing)}`, 'format');
        stage.status = 'failed';
      }

      if (strictMode && stage.extra.length > 0) {
        result.warnings.push(`Extra unexpected fields: ${JSON.stringify(stage.extra)}`);
        result.addError(`Extra keys not allowed: ${JSON.stringify(stage.extra)}`, 'format');
        stage.status = 'failed';
      }
    }

    result.fieldCountValid = stage.status === 'success';
    result.stageResults.fieldCount = stage;
  }

  static stageRegexValidation(data, regexPatterns, result) {
    if (typeof data !== 'object' || Array.isArray(data)) {
      result.regexValid = true;
      return;
    }

    const stage = { status: 'success', checked: 0, failed: 0, details: [] };

    for (const [fieldName, pattern] of Object.entries(regexPatterns)) {
      if (!(fieldName in data)) continue;

      stage.checked++;
      const value = String(data[fieldName]);

      try {
        const regex = new RegExp(`^${pattern}$`);
        if (!regex.test(value)) {
          stage.failed++;
          stage.details.push({
            field: fieldName,
            pattern,
            valuePreview: value.substring(0, 100),
            status: 'no_match',
          });
          result.addError(
            `Format error for '${fieldName}': value does not match required pattern`,
            'format'
          );
        }
      } catch (e) {
        stage.details.push({
          field: fieldName,
          error: `Invalid regex: ${e.message}`,
        });
      }
    }

    if (stage.failed > 0) {
      stage.status = 'failed';
      result.regexValid = false;
    } else {
      result.regexValid = true;
    }

    result.stageResults.regex = stage;
  }

  static stageConfidenceScoring(data, schema, expectedFields, result) {
    const scores = [];

    if (typeof data !== 'object' || Array.isArray(data)) {
      result.confidenceScore = result.jsonValid ? 0.1 : 0.0;
      result.stageResults.confidence = { score: result.confidenceScore, method: 'non_dict' };
      return;
    }

    // Completeness Score
    if (expectedFields && expectedFields.length > 0) {
      const present = expectedFields.filter(f => f in data).length;
      const completeness = present / expectedFields.length;
      scores.push(['completeness', completeness]);
    }

    // Content Quality Score
    let nonEmpty = 0;
    const total = Object.keys(data).length;
    for (const value of Object.values(data)) {
      if (value !== null && value !== '' && !this.isEmpty(value)) {
        nonEmpty++;
      }
    }
    const quality = nonEmpty / Math.max(total, 1);
    scores.push(['content_quality', quality]);

    // Validation Pass Rate
    const stagesPassed = [
      result.jsonValid,
      result.schemaValid,
      result.typeCheckValid,
      result.regexValid,
      result.fieldCountValid,
    ].filter(s => s).length;
    const validationRate = stagesPassed / 5;
    scores.push(['validation_rate', validationRate]);

    // Error Penalty
    const errorPenalty = Math.max(0, 1 - (result.errors.length * 0.15));
    scores.push(['error_penalty', errorPenalty]);

    // Weighted Average
    let totalScore = 0;
    if (scores.length > 0) {
      totalScore = scores.reduce((sum, [, val]) => sum + val, 0) / scores.length;
    } else {
      totalScore = result.jsonValid ? 0.5 : 0.0;
    }

    result.confidenceScore = Math.round(Math.min(1.0, Math.max(0.0, totalScore)) * 10000) / 10000;
    result.stageResults.confidence = {
      score: result.confidenceScore,
      components: Object.fromEntries(scores.map(([name, val]) => [name, Math.round(val * 10000) / 10000])),
    };
  }

  static isEmpty(value) {
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0;
    return false;
  }
}

// ==============================================================================
// HALLUCINATION DETECTOR
// ==============================================================================
class HallucinationDetector {
  static estimateProbability(prompt, response, parsedData = null) {
    let score = 0.0;
    let checks = 0;

    if (!response) return 0.0;

    // Check 1: Response much longer than prompt
    if (response.length > prompt.length * 10) {
      score += 0.3;
    }
    checks++;

    // Check 2: Contains hedging language
    const hedgingPatterns = [
      /\bi think\b/i, /\bprobably\b/i, /\bmaybe\b/i,
      /\bI'm not sure\b/i, /\bI believe\b/i, /\bpossibly\b/i,
      /\bapproximately\b/i, /\bI don't have\b/i,
    ];
    const hedgingCount = hedgingPatterns.filter(p => p.test(response)).length;
    if (hedgingCount >= 3) {
      score += 0.4;
    } else if (hedgingCount >= 1) {
      score += 0.15;
    }
    checks++;

    // Check 3: Contradictory statements
    if (/\bhowever\b.*\bbut\b/is.test(response)) {
      score += 0.1;
    }
    checks++;

    // Check 4: Repetitive content
    const sentences = response.split(/[.!?]+/);
    if (sentences.length > 3) {
      const unique = new Set(sentences.map(s => s.trim().toLowerCase()).filter(s => s));
      const uniqueRatio = unique.size / sentences.length;
      if (uniqueRatio < 0.5) {
        score += 0.4;
      }
    }
    checks++;

    // Check 5: Contains fabricated-looking data
    if (parsedData && typeof parsedData === 'object') {
      let roundCount = 0;
      let totalNumbers = 0;
      for (const value of Object.values(parsedData)) {
        if (typeof value === 'number') {
          totalNumbers++;
          if (value === Math.round(value) && value > 0) {
            roundCount++;
          }
        }
      }
      if (totalNumbers > 3 && roundCount / totalNumbers > 0.8) {
        score += 0.2;
      }
    }
    checks++;

    return Math.min(1.0, score / (checks * 0.3));
  }
}

module.exports = {
  ValidationResult,
  ValidationEngine,
  HallucinationDetector,
};
