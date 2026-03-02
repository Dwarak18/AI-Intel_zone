// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Database Seeder
// ==============================================================================

require('dotenv').config();
const { sequelize, User, Team, TeamMember, Mission } = require('./models');
const config = require('./config');

const ADMIN_USERNAME = config.adminUsername || 'admin';
const ADMIN_PASSWORD = config.adminPassword || 'ControlArena2024!';

const MISSIONS = [
  {
    missionCode: 'M01',
    title: 'JSON Identity Challenge',
    description: 'Prompt the AI to output a specific JSON structure exactly as provided. The AI must produce a valid JSON object with required fields without adding hallucinated content.',
    difficulty: 'easy',
    category: 'json_parsing',
    maxPoints: 100,
    timeLimitSeconds: 600,
    maxRetries: 20,
    orderIndex: 1,
    isVisible: true,
    expectedSchema: JSON.stringify({
      type: 'object',
      required: ['status', 'message', 'code'],
      properties: {
        status: { type: 'string', enum: ['success', 'error', 'pending'] },
        message: { type: 'string', minLength: 1, maxLength: 500 },
        code: { type: 'integer', minimum: 100, maximum: 599 },
      },
      additionalProperties: false,
    }),
    expectedFields: JSON.stringify(['status', 'message', 'code']),
    sampleResponse: JSON.stringify({ status: 'success', message: 'Operation completed', code: 200 }, null, 2),
  },
  {
    missionCode: 'M02',
    title: 'Sentiment Classifier',
    description: 'Make the AI classify text sentiment and return structured output with sentiment label, confidence score, and keyword extraction — all in valid JSON.',
    difficulty: 'medium',
    category: 'nlp',
    maxPoints: 150,
    timeLimitSeconds: 600,
    maxRetries: 20,
    orderIndex: 2,
    isVisible: true,
    expectedSchema: JSON.stringify({
      type: 'object',
      required: ['sentiment', 'confidence', 'keywords'],
      properties: {
        sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
        confidence: { type: 'number', minimum: 0.0, maximum: 1.0 },
        keywords: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
      },
      additionalProperties: false,
    }),
    expectedFields: JSON.stringify(['sentiment', 'confidence', 'keywords']),
    sampleResponse: JSON.stringify({ sentiment: 'positive', confidence: 0.92, keywords: ['excellent', 'innovative', 'powerful'] }, null, 2),
  },
  {
    missionCode: 'M03',
    title: 'Data Structure Builder',
    description: 'Prompt the AI to construct a specific nested data structure following exact specifications: a tree with precise depth, node values, and parent-child relationships.',
    difficulty: 'medium',
    category: 'data_structures',
    maxPoints: 150,
    timeLimitSeconds: 900,
    maxRetries: 20,
    orderIndex: 3,
    isVisible: true,
    expectedSchema: JSON.stringify({
      type: 'object',
      required: ['root'],
      properties: {
        root: {
          type: 'object',
          required: ['value', 'depth', 'children'],
          properties: {
            value: { type: 'integer' },
            depth: { type: 'integer' },
            children: { type: 'array' },
          },
        },
      },
      additionalProperties: false,
    }),
    expectedFields: JSON.stringify(['root']),
    sampleResponse: JSON.stringify({
      root: {
        value: 42, depth: 0,
        children: [
          { value: 10, depth: 1, children: [] },
          { value: 32, depth: 1, children: [] },
        ],
      },
    }, null, 2),
  },
  {
    missionCode: 'M04',
    title: 'API Response Simulator',
    description: 'Get the AI to simulate realistic API error responses with proper HTTP status codes, error types, timestamps in ISO 8601 format, and request UUIDs.',
    difficulty: 'hard',
    category: 'api_simulation',
    maxPoints: 200,
    timeLimitSeconds: 900,
    maxRetries: 15,
    orderIndex: 4,
    isVisible: true,
    expectedSchema: JSON.stringify({
      type: 'object',
      required: ['status_code', 'error_type', 'timestamp', 'request_id', 'details'],
      properties: {
        status_code: { type: 'integer', minimum: 400, maximum: 599 },
        error_type: { type: 'string' },
        timestamp: { type: 'string' },
        request_id: { type: 'string' },
        details: { type: 'object' },
      },
      additionalProperties: false,
    }),
    expectedFields: JSON.stringify(['status_code', 'error_type', 'timestamp', 'request_id', 'details']),
    sampleResponse: JSON.stringify({
      status_code: 404,
      error_type: 'ResourceNotFound',
      timestamp: '2024-01-15T10:30:00.000Z',
      request_id: '550e8400-e29b-41d4-a716-446655440000',
      details: { resource: 'user', id: '12345' },
    }, null, 2),
  },
  {
    missionCode: 'M05',
    title: 'Final Challenge: AI Meta-Analysis',
    description: 'The ultimate test. Prompt the AI to perform a meta-analysis of its own capabilities, producing a comprehensive JSON report with multiple nested sections, arrays, and a coherent final statement of at least 20 words.',
    difficulty: 'expert',
    category: 'meta_analysis',
    maxPoints: 300,
    timeLimitSeconds: 1200,
    maxRetries: 10,
    orderIndex: 5,
    isVisible: true,
    expectedSchema: JSON.stringify({
      type: 'object',
      required: ['analysis_id', 'capabilities', 'limitations', 'confidence_metrics', 'final_statement'],
      properties: {
        analysis_id: { type: 'string' },
        capabilities: { type: 'array', items: { type: 'string' }, minItems: 3 },
        limitations: { type: 'array', items: { type: 'string' }, minItems: 2 },
        confidence_metrics: {
          type: 'object',
          required: ['overall', 'reasoning', 'factual'],
          properties: {
            overall: { type: 'number', minimum: 0.0, maximum: 1.0 },
            reasoning: { type: 'number', minimum: 0.0, maximum: 1.0 },
            factual: { type: 'number', minimum: 0.0, maximum: 1.0 },
          },
        },
        final_statement: { type: 'string', minLength: 100 },
      },
      additionalProperties: false,
    }),
    expectedFields: JSON.stringify(['analysis_id', 'capabilities', 'limitations', 'confidence_metrics', 'final_statement']),
    sampleResponse: JSON.stringify({
      analysis_id: 'META-001',
      capabilities: ['natural language understanding', 'code generation', 'multi-step reasoning'],
      limitations: ['knowledge cutoff', 'hallucination tendency'],
      confidence_metrics: { overall: 0.87, reasoning: 0.91, factual: 0.83 },
      final_statement: 'I am a large language model trained to assist with a wide variety of tasks, combining extensive training data with advanced reasoning capabilities while maintaining appropriate epistemic humility about my limitations.',
    }, null, 2),
  },
];

const TEAMS = [
  { teamCode: 'ALPHA', name: 'Team Alpha', institution: 'MIT', members: [{ username: 'alpha_lead', email: 'alpha_lead@team.io' }, { username: 'alpha_member', email: 'alpha_member@team.io' }] },
  { teamCode: 'BETA', name: 'Team Beta', institution: 'Stanford', members: [{ username: 'beta_lead', email: 'beta_lead@team.io' }] },
  { teamCode: 'GAMMA', name: 'Team Gamma', institution: 'Carnegie Mellon', members: [{ username: 'gamma_lead', email: 'gamma_lead@team.io' }] },
  { teamCode: 'DELTA', name: 'Team Delta', institution: 'Caltech', members: [{ username: 'delta_lead', email: 'delta_lead@team.io' }] },
  { teamCode: 'EPSILON', name: 'Team Epsilon', institution: 'UC Berkeley', members: [{ username: 'epsilon_lead', email: 'epsilon_lead@team.io' }] },
  { teamCode: 'ZETA', name: 'Team Zeta', institution: 'Harvard', members: [{ username: 'zeta_lead', email: 'zeta_lead@team.io' }] },
  { teamCode: 'ETA', name: 'Team Eta', institution: 'Princeton', members: [{ username: 'eta_lead', email: 'eta_lead@team.io' }] },
  { teamCode: 'THETA', name: 'Team Theta', institution: 'Yale', members: [{ username: 'theta_lead', email: 'theta_lead@team.io' }] },
  { teamCode: 'IOTA', name: 'Team Iota', institution: 'Columbia', members: [{ username: 'iota_lead', email: 'iota_lead@team.io' }] },
  { teamCode: 'KAPPA', name: 'Team Kappa', institution: 'Cornell', members: [{ username: 'kappa_lead', email: 'kappa_lead@team.io' }] },
];

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
    console.log(`  Admin user already exists: ${ADMIN_USERNAME}`);
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

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
