// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Database Seeder
// ==============================================================================

require('dotenv').config();
const { sequelize, User, Team, TeamMember, Mission } = require('./models');
const config = require('./config');

const ADMIN_USERNAME = config.adminUsername || 'admin';
const ADMIN_PASSWORD = config.adminPassword || 'heisenberg';

const MISSIONS = [
  // ─────────────────────────────────────────────────────────────
  // M01 · JSON Identity Challenge  ·  EASY  ·  100 pts
  // ─────────────────────────────────────────────────────────────
  {
    missionCode: 'M01',
    title: 'JSON Identity Challenge',
    description: 'Prompt the AI to reproduce an exact JSON object. No extra fields, no markdown fences, no explanation — pure valid JSON only.',
    difficulty: 'easy',
    category: 'json_parsing',
    maxPoints: 100,
    timeLimitSeconds: 600,
    maxRetries: 20,
    orderIndex: 1,
    isVisible: true,

    objective:
      'Your goal is to craft a prompt that makes an AI model return the following JSON object ' +
      'verbatim. The response must contain exactly three fields (status, message, code) with valid ' +
      'values — no extra keys, no wrapper text, no markdown code blocks.',

    inputText:
      '{\n' +
      '  "status": "success",\n' +
      '  "message": "Operation completed successfully",\n' +
      '  "code": 200\n' +
      '}',

    outputFormatHint:
      'Return ONLY a raw JSON object — no backticks, no ```json fences, no commentary. ' +
      'Exactly 3 fields: status (string), message (string), code (integer between 100–599). ' +
      'No additional properties are allowed.',

    enumConstraints: JSON.stringify({
      status: ['success', 'error', 'pending'],
    }),

    validExample: JSON.stringify(
      { status: 'success', message: 'Operation completed successfully', code: 200 },
      null, 2
    ),
    invalidExample: JSON.stringify(
      { status: 'ok', message: 'done', code: 200, extra_field: 'not allowed' },
      null, 2
    ),

    expectedSchema: JSON.stringify({
      type: 'object',
      required: ['status', 'message', 'code'],
      properties: {
        status:  { type: 'string', enum: ['success', 'error', 'pending'] },
        message: { type: 'string', minLength: 1, maxLength: 500 },
        code:    { type: 'integer', minimum: 100, maximum: 599 },
      },
      additionalProperties: false,
    }),
    expectedFields: JSON.stringify(['status', 'message', 'code']),
    sampleResponse: JSON.stringify({ status: 'success', message: 'Operation completed successfully', code: 200 }, null, 2),
  },

  // ─────────────────────────────────────────────────────────────
  // M02 · Sentiment Classifier  ·  MEDIUM  ·  150 pts
  // ─────────────────────────────────────────────────────────────
  {
    missionCode: 'M02',
    title: 'Sentiment Classifier',
    description: 'Make the AI perform sentiment analysis on a customer review and return structured JSON with label, confidence score, and extracted keywords.',
    difficulty: 'medium',
    category: 'nlp',
    maxPoints: 150,
    timeLimitSeconds: 600,
    maxRetries: 20,
    orderIndex: 2,
    isVisible: true,

    objective:
      'Craft a prompt that instructs an AI to analyze the customer review below and output a ' +
      'structured sentiment classification. The result must include: the overall sentiment label, ' +
      'a confidence score between 0.0 and 1.0, and an array of key sentiment-driving words ' +
      'extracted directly from the review text.',

    inputText:
      'I recently purchased the NovaX Pro wireless headphones and I\'m genuinely impressed. ' +
      'The sound quality is crystal-clear with deep bass and crisp highs. Battery life easily ' +
      'lasts 30+ hours and the noise cancellation is outstanding — I can focus completely even ' +
      'in noisy environments. The build feels premium and the ear cushions are comfortable for ' +
      'extended use. Setup was effortless and the companion app is intuitive. Highly recommend ' +
      'for anyone looking for a reliable, high-performance audio experience.',

    outputFormatHint:
      'Return a JSON object with exactly 3 fields: ' +
      '"sentiment" (one of: positive / negative / neutral), ' +
      '"confidence" (a float from 0.0 to 1.0 representing certainty), ' +
      '"keywords" (an array of 3–8 meaningful words extracted from the text). ' +
      'No other properties allowed. No markdown.',

    enumConstraints: JSON.stringify({
      sentiment: ['positive', 'negative', 'neutral'],
    }),

    validExample: JSON.stringify(
      { sentiment: 'positive', confidence: 0.95, keywords: ['impressive', 'crystal-clear', 'outstanding', 'comfortable', 'intuitive'] },
      null, 2
    ),
    invalidExample: JSON.stringify(
      { sentiment: 'very positive', confidence: 1.2, keywords: 'impressive, clear', extra: true },
      null, 2
    ),

    expectedSchema: JSON.stringify({
      type: 'object',
      required: ['sentiment', 'confidence', 'keywords'],
      properties: {
        sentiment:  { type: 'string', enum: ['positive', 'negative', 'neutral'] },
        confidence: { type: 'number', minimum: 0.0, maximum: 1.0 },
        keywords:   { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
      },
      additionalProperties: false,
    }),
    expectedFields: JSON.stringify(['sentiment', 'confidence', 'keywords']),
    sampleResponse: JSON.stringify(
      { sentiment: 'positive', confidence: 0.95, keywords: ['impressive', 'crystal-clear', 'outstanding', 'comfortable', 'intuitive'] },
      null, 2
    ),
  },

  // ─────────────────────────────────────────────────────────────
  // M03 · Data Structure Builder  ·  MEDIUM  ·  150 pts
  // ─────────────────────────────────────────────────────────────
  {
    missionCode: 'M03',
    title: 'Data Structure Builder',
    description: 'Prompt the AI to construct a specific nested tree following precise specifications: exact node values, depths, and parent-child relationships encoded in JSON.',
    difficulty: 'medium',
    category: 'data_structures',
    maxPoints: 150,
    timeLimitSeconds: 900,
    maxRetries: 20,
    orderIndex: 3,
    isVisible: true,

    objective:
      'Craft a prompt that makes an AI build the binary tree described below as a nested JSON ' +
      'object. The tree has a root node with value 50 at depth 0. Its left child has value 30 ' +
      '(depth 1) with two leaf children: 20 and 40 (depth 2). Its right child has value 70 ' +
      '(depth 1) with two leaf children: 60 and 80 (depth 2). Every node must contain exactly ' +
      'three keys: value, depth, and children (array, empty for leaves).',

    inputText:
      'Build the following binary tree as nested JSON:\n\n' +
      '        50          ← root (depth 0)\n' +
      '       /  \\\n' +
      '     30    70       ← depth 1\n' +
      '    / \\   / \\\n' +
      '  20  40 60  80     ← depth 2 (leaves)',

    outputFormatHint:
      'Return a JSON object with a single top-level key "root". Each tree node must be an object ' +
      'with exactly: "value" (integer), "depth" (integer, 0-indexed), "children" (array of node ' +
      'objects; empty array [] for leaf nodes). No additional properties at any level.',

    enumConstraints: null,

    validExample: JSON.stringify({
      root: {
        value: 50, depth: 0,
        children: [
          { value: 30, depth: 1, children: [
            { value: 20, depth: 2, children: [] },
            { value: 40, depth: 2, children: [] },
          ]},
          { value: 70, depth: 1, children: [
            { value: 60, depth: 2, children: [] },
            { value: 80, depth: 2, children: [] },
          ]},
        ],
      },
    }, null, 2),
    invalidExample: JSON.stringify({
      root: {
        val: 50,
        left: { val: 30 },
        right: { val: 70 },
      },
    }, null, 2),

    expectedSchema: JSON.stringify({
      type: 'object',
      required: ['root'],
      properties: {
        root: {
          type: 'object',
          required: ['value', 'depth', 'children'],
          properties: {
            value:    { type: 'integer' },
            depth:    { type: 'integer' },
            children: { type: 'array' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    }),
    expectedFields: JSON.stringify(['root']),
    sampleResponse: JSON.stringify({
      root: {
        value: 50, depth: 0,
        children: [
          { value: 30, depth: 1, children: [
            { value: 20, depth: 2, children: [] },
            { value: 40, depth: 2, children: [] },
          ]},
          { value: 70, depth: 1, children: [
            { value: 60, depth: 2, children: [] },
            { value: 80, depth: 2, children: [] },
          ]},
        ],
      },
    }, null, 2),
  },

  // ─────────────────────────────────────────────────────────────
  // M04 · API Response Simulator  ·  HARD  ·  200 pts
  // ─────────────────────────────────────────────────────────────
  {
    missionCode: 'M04',
    title: 'API Response Simulator',
    description: 'Engineer a prompt that makes an AI generate a realistic, fully-formed API error response with proper HTTP codes, ISO 8601 timestamps, and UUID request identifiers.',
    difficulty: 'hard',
    category: 'api_simulation',
    maxPoints: 200,
    timeLimitSeconds: 900,
    maxRetries: 15,
    orderIndex: 4,
    isVisible: true,

    objective:
      'Craft a prompt that instructs an AI to simulate the exact API error response for the ' +
      'scenario described below. The response must model real-world REST API error conventions: ' +
      'a 4xx/5xx HTTP status code, a machine-readable error type string, an ISO 8601 timestamp ' +
      'with millisecond precision, a UUID v4 request identifier, and a "details" sub-object ' +
      'describing the specific failure. No extra top-level fields are permitted.',

    inputText:
      'Scenario: A microservice called "inventory-service" received a POST /api/v2/orders ' +
      'request from client app "storefront-web". The request payload referenced product SKU ' +
      '"SKU-88421" but that product does not exist in the inventory database. The request was ' +
      'processed at 2025-06-14 09:45:22 UTC. The gateway assigned request trace ID ' +
      '3fa85f64-5717-4562-b3fc-2c963f66afa6. Return the appropriate API error response JSON.',

    outputFormatHint:
      'Return a JSON object with exactly 5 top-level fields: ' +
      '"status_code" (integer, 400–599), ' +
      '"error_type" (string, PascalCase e.g. ResourceNotFound), ' +
      '"timestamp" (string, ISO 8601 with milliseconds e.g. 2025-06-14T09:45:22.000Z), ' +
      '"request_id" (string, valid UUID v4 format), ' +
      '"details" (object describing the failure — at minimum include "service" and "message" keys). ' +
      'No additional top-level properties. No markdown.',

    enumConstraints: null,

    validExample: JSON.stringify({
      status_code: 404,
      error_type: 'ResourceNotFound',
      timestamp: '2025-06-14T09:45:22.000Z',
      request_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      details: {
        service: 'inventory-service',
        message: 'Product SKU-88421 does not exist in the inventory database.',
        sku: 'SKU-88421',
        endpoint: 'POST /api/v2/orders',
      },
    }, null, 2),
    invalidExample: JSON.stringify({
      code: 404,
      error: 'not found',
      time: '2025-06-14',
      id: '3fa85f64',
      info: 'product missing',
    }, null, 2),

    expectedSchema: JSON.stringify({
      type: 'object',
      required: ['status_code', 'error_type', 'timestamp', 'request_id', 'details'],
      properties: {
        status_code: { type: 'integer', minimum: 400, maximum: 599 },
        error_type:  { type: 'string' },
        timestamp:   { type: 'string' },
        request_id:  { type: 'string' },
        details:     { type: 'object' },
      },
      additionalProperties: false,
    }),
    expectedFields: JSON.stringify(['status_code', 'error_type', 'timestamp', 'request_id', 'details']),
    sampleResponse: JSON.stringify({
      status_code: 404,
      error_type: 'ResourceNotFound',
      timestamp: '2025-06-14T09:45:22.000Z',
      request_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      details: { service: 'inventory-service', message: 'Product SKU-88421 does not exist in the inventory database.', sku: 'SKU-88421' },
    }, null, 2),
  },

  // ─────────────────────────────────────────────────────────────
  // M05 · Final Challenge: AI Meta-Analysis  ·  EXPERT  ·  300 pts
  // ─────────────────────────────────────────────────────────────
  {
    missionCode: 'M05',
    title: 'Final Challenge: AI Meta-Analysis',
    description: 'The ultimate test — engineer a multi-layered prompt that makes an AI compose a rigorous self-evaluation report in strict JSON covering capabilities, limitations, confidence metrics, and a detailed concluding statement.',
    difficulty: 'expert',
    category: 'meta_analysis',
    maxPoints: 300,
    timeLimitSeconds: 1200,
    maxRetries: 10,
    orderIndex: 5,
    isVisible: true,

    objective:
      'Design an advanced prompt that instructs an AI model to produce a structured ' +
      'self-evaluation report covering: (a) at least 3 distinct capabilities it possesses, ' +
      '(b) at least 2 honest limitations, (c) numerical confidence scores for overall ' +
      'performance, reasoning quality, and factual accuracy (each 0.0–1.0), and (d) a ' +
      'concluding statement of at least 100 characters that synthesises the findings. ' +
      'All values must be realistic, specific, and internally consistent. ' +
      'The analysis_id must follow the format "META-XXX" where XXX is a 3-digit number. ' +
      'This mission tests your ability to elicit structured self-reflection from an AI — ' +
      'a skill that underpins alignment research, capability evaluation, and AI auditing.',

    inputText:
      'Research Subject: Large Language Model (LLM) Capability Evaluation\n\n' +
      'Task: Produce a rigorous, introspective meta-analysis of your own AI capabilities ' +
      'and limitations as of your training cutoff. Be specific and concrete. Avoid generic ' +
      'platitudes. Include quantified confidence estimates based on your observed performance ' +
      'across reasoning, factual recall, and language tasks. Provide a synthesis statement ' +
      'that integrates the findings into a coherent evaluation of your overall utility ' +
      'for high-stakes decision-support applications.',

    outputFormatHint:
      'Return a JSON object with exactly 5 top-level fields: ' +
      '"analysis_id" (string matching pattern META-\\d{3}), ' +
      '"capabilities" (array of ≥3 specific capability strings), ' +
      '"limitations" (array of ≥2 specific limitation strings), ' +
      '"confidence_metrics" (object with 3 numeric sub-fields: overall, reasoning, factual — each 0.0–1.0), ' +
      '"final_statement" (string of ≥100 characters). ' +
      'No extra top-level keys. Strings must be substantive — no one-word entries.',

    enumConstraints: null,

    validExample: JSON.stringify({
      analysis_id: 'META-001',
      capabilities: [
        'Multi-step mathematical and logical reasoning across diverse problem domains',
        'Code generation and debugging in 20+ programming languages with idiomatic style',
        'Contextual summarisation of long documents while preserving key nuance',
        'Cross-lingual translation and semantic equivalence detection',
      ],
      limitations: [
        'Knowledge cutoff prevents awareness of events after training date, causing potential factual staleness',
        'Susceptibility to confident hallucination of plausible but incorrect specific facts and citations',
        'Performance degrades on tasks requiring sustained multi-hop reasoning beyond ~10 inferential steps',
      ],
      confidence_metrics: {
        overall:   0.84,
        reasoning: 0.89,
        factual:   0.78,
      },
      final_statement:
        'This LLM demonstrates strong general-purpose language capabilities with particularly high ' +
        'performance in structured reasoning and code generation tasks, while exhibiting known ' +
        'limitations in temporal awareness and factual precision. Deployment in high-stakes environments ' +
        'should incorporate human-in-the-loop verification for time-sensitive or citation-critical outputs.',
    }, null, 2),
    invalidExample: JSON.stringify({
      analysis_id: 'meta1',
      capabilities: ['smart', 'helpful'],
      limitations: ['sometimes wrong'],
      confidence: 0.9,
      summary: 'I am a good AI.',
    }, null, 2),

    expectedSchema: JSON.stringify({
      type: 'object',
      required: ['analysis_id', 'capabilities', 'limitations', 'confidence_metrics', 'final_statement'],
      properties: {
        analysis_id:        { type: 'string' },
        capabilities:       { type: 'array', items: { type: 'string' }, minItems: 3 },
        limitations:        { type: 'array', items: { type: 'string' }, minItems: 2 },
        confidence_metrics: {
          type: 'object',
          required: ['overall', 'reasoning', 'factual'],
          properties: {
            overall:   { type: 'number', minimum: 0.0, maximum: 1.0 },
            reasoning: { type: 'number', minimum: 0.0, maximum: 1.0 },
            factual:   { type: 'number', minimum: 0.0, maximum: 1.0 },
          },
        },
        final_statement: { type: 'string', minLength: 100 },
      },
      additionalProperties: false,
    }),
    expectedFields: JSON.stringify(['analysis_id', 'capabilities', 'limitations', 'confidence_metrics', 'final_statement']),
    sampleResponse: JSON.stringify({
      analysis_id: 'META-001',
      capabilities: ['multi-step reasoning', 'code generation in 20+ languages', 'cross-lingual translation', 'long-document summarisation'],
      limitations: ['knowledge cutoff causes temporal staleness', 'hallucination of plausible but incorrect facts'],
      confidence_metrics: { overall: 0.84, reasoning: 0.89, factual: 0.78 },
      final_statement: 'This LLM demonstrates strong general-purpose language capabilities with high performance in structured reasoning and code generation, while exhibiting known limitations in factual precision. High-stakes deployments should incorporate human verification for citation-critical outputs.',
    }, null, 2),
  },
];

const TEAMS = [];

async function seed() {
  console.log('Syncing database...');
  await sequelize.sync({ force: false, alter: true });

  // Admin user
  let admin = await User.findOne({ where: { username: ADMIN_USERNAME } });
  if (!admin) {
    admin = User.build({ username: ADMIN_USERNAME, email: 'admin@controllarena.local', role: 'admin', isActive: true });
    await admin.setPassword(ADMIN_PASSWORD);
    await admin.save();
    console.log(`✓ Admin user created: ${ADMIN_USERNAME}`);
  } else {
    // Always sync password so env/config changes take effect
    await admin.setPassword(ADMIN_PASSWORD);
    await admin.save();
    console.log(`✓ Admin password updated: ${ADMIN_USERNAME}`);
  }

  // Moderator
  let mod = await User.findOne({ where: { username: 'moderator' } });
  if (!mod) {
    mod = User.build({ username: 'moderator', email: 'moderator@controllarena.local', role: 'admin', isActive: true });
    await mod.setPassword('Moderator2024!');
    await mod.save();
    console.log('✓ Moderator user created');
  }

  // Missions
  for (const mdata of MISSIONS) {
    const existing = await Mission.findOne({ where: { missionCode: mdata.missionCode } });
    if (!existing) {
      await Mission.create({ ...mdata, isActive: true });
      console.log(`✓ Mission created: ${mdata.missionCode} - ${mdata.title}`);
    } else {
      console.log(`  Mission already exists: ${mdata.missionCode}`);
    }
  }

  // Teams
  for (const tdata of TEAMS) {
    let team = await Team.findOne({ where: { teamCode: tdata.teamCode } });
    if (!team) {
      team = await Team.create({
        teamCode: tdata.teamCode,
        name: tdata.name,
        institution: tdata.institution,
        status: 'active',
      });
      console.log(`✓ Team created: ${tdata.teamCode} - ${tdata.name}`);
    } else {
      console.log(`  Team already exists: ${tdata.teamCode}`);
      continue;
    }

    for (const mdata of tdata.members) {
      let user = await User.findOne({ where: { username: mdata.username } });
      if (!user) {
        user = User.build({
          username: mdata.username,
          email: mdata.email,
          role: 'team_member',
          isActive: true,
        });
        await user.setPassword(`${tdata.teamCode}_password_2024!`);
        await user.save();
      }
      const exists = await TeamMember.findOne({ where: { teamId: team.id, userId: user.id } });
      if (!exists) {
        await TeamMember.create({ teamId: team.id, userId: user.id, roleInTeam: 'leader', isActive: true });
        console.log(`  ✓ Member added: ${mdata.username} → ${tdata.teamCode}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(' SEED COMPLETE');
  console.log(`\n Admin: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  console.log(' Team credentials: {teamCode}_password_2024! (e.g. ALPHA_password_2024!)');
  console.log('='.repeat(60) + '\n');
}

// Export for use as a module (called from app.js after server starts)
module.exports = { run: seed };

// Auto-run only when invoked directly: node src/seed.js
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
