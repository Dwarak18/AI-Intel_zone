// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Team Seeder  ·  Imports 44 teams from TEAMS-DATA.xlsx
// Usage: node src/seed_teams.js
// ==============================================================================

require('dotenv').config();
const { sequelize, User, Team, TeamMember } = require('./models');

// ---------------------------------------------------------------------------
// Team data extracted from TEAMS-DATA.xlsx
// ---------------------------------------------------------------------------
const TEAMS = [
  { id: 'TECH-385276', name: 'CIPHER-SYNDICATE', pass: 'Cipher26', members: ['Thirunavukkarasu.S', 'Praveen.S', 'Pragadheesh.T', 'Jennifer.J'] },
  { id: 'TECH-331164', name: 'SANTHOSH.V', pass: 'AI&DS 007', members: ['Praveen.R', 'SANTHOSH.V', 'UDHAYAGIRI', 'Vigneshwaran'] },
  { id: 'TECH-852660', name: 'RUNTIME_RUBBLES', pass: 'Saha@100807', members: ['Sahana e', 'jagadeeswaran b', 'venkata giri', 'priyan v'] },
  { id: 'TECH-865884', name: 'BYTE-BIGILS', pass: 'byte(2026@bigils)', members: ['Vishnuvarthan N', 'Ramanathan R', 'Rubesh p', 'Bhuvaneshwari B'] },
  { id: 'TECH-561465', name: 'BASS-TECHIES', pass: 'bass-atti-67', members: ['K.abishek', 'JABEZ BENNY I', 'P Sakthi Sabareesh', 'Santhosh Muthukumar M'] },
  { id: 'TECH-299197', name: 'HASHIRA-TECH', pass: 'VADH1792', members: ['VASANTHAMANIGANDAN K', 'HARIHARAN U', 'DELRAJ S', 'anbucheLvan K'] },
  { id: 'TECH-851354', name: 'OG-CODERS', pass: 'barani008', members: ['Barani Tharan T', 'Jayakumar n', 'Daniel G', 'Govaradhanan d'] },
  { id: 'TECH-410955', name: 'THE-VISIONARIES', pass: 'ramgowthamp2007', members: ['Ram Gowtham', 'Magi sharma', 'Pranesh', 'Arshath'] },
  { id: 'TECH-647375', name: 'QUANTUM-CODERS', pass: 'SIMATS26', members: ['THARUN KUMAR', 'HARI RAM', 'DHEERAJ'] },
  { id: 'TECH-392989', name: 'TEAM-NOVA-', pass: 'teamnovaXtechtitans', members: ['Mecpikka sherin.M', 'Mani Govindan.s', 'Mennaloshini.k', 'Shaik naved.b'] },
  { id: 'TECH-286446', name: 'OMEGA', pass: 'stjosephs', members: ['Bharathi v', 'Arun kumar v', 'Diwakar i', 'Dharshiyan m'] },
  { id: 'TECH-231614', name: 'MANJA-PAI', pass: '100000', members: ['Aaqil ahmad', 'Hariharan', 'Syed nashwan', 'Sai suman'] },
  { id: 'TECH-667995', name: 'JUSTICE-SOCIETY', pass: 'girihajaharijesh', members: ['Hari Krishna T', 'Jeshwin Sharun A S', 'Giri Vardhan M', 'Haja Kalam A'] },
  { id: 'TECH-776701', name: 'SV2-XTREME', pass: 'SV2SV2@', members: ['SRIDHAR MASILAMANI', 'Vimaleshwaran G', 'Vishva v'] },
  { id: 'TECH-332681', name: 'SHADOW-HACKERS', pass: 'Karthika*14122006', members: ['bhuvaneshwari s', 'gopika n', 'kowsalyasri'] },
  { id: 'TECH-728440', name: 'KERNAL-KING', pass: 'karthika*100724', members: ['karthika v', 'kaviya k', 'janani c'] },
  { id: 'TECH-238204', name: 'AUTOMINDS', pass: 'Automation', members: ['Vishnu', 'Sharli', 'Santhosh', 'Muruga vignesh'] },
  { id: 'TECH-341646', name: 'AI-TRINITY', pass: 'Ai@2005', members: ['Abijo', 'Anison', 'Abirami', 'Ashmi.c.s'] },
  { id: 'TECH-448720', name: 'EVENT-VAROM-GUYS', pass: '123ABC', members: ['rokith s v', 'Jeevitha', 'R S S Barath', 'Divagar G'] },
  { id: 'TECH-171352', name: 'QUADVERTEX', pass: 'ktpv*2027', members: ['Pradeepraja .R. B', 'Tamizharasan R', 'Kaleeswaran m', 'Varshini b'] },
  { id: 'TECH-273157', name: 'HACK4', pass: '@Hack4', members: ['Yashwanth S', 'vineeth a', 'lingeshkumar p', 'vishwa r'] },
  { id: 'TECH-783205', name: 'TECH-BYTE', pass: 'LISD067', members: ['LOKESHWARI PRABAKARAN', 'IDHARSHANA A', 'HEMASRIDHARAN S', 'DHARSHAN D'] },
  { id: 'TECH-886097', name: 'SHECODES', pass: 'Shecodes2468', members: ['HARSHAVARTHANY', 'KEERTHANA GUIRY', 'DHIVYADHARSHINI M', 'DHENISHA M'] },
  { id: 'TECH-841105', name: 'COREVA', pass: 'Coreva2468', members: ['PRIYADARSHINI siddarth', 'SARAvanaperumal V', 'SHAHINA BEGUM', 'DHANUSH KARTIK K'] },
  { id: 'TECH-326483', name: 'CODE-RUSH', pass: 'coderushers', members: ['S.Saravana', 'G.gokulakrishnan', 'M.Anandraj', 'M.Yuvanshankar'] },
  { id: 'TECH-857628', name: 'TECH-WIZARD', pass: 'Techwizard2468', members: ['SABARI VISHNU R', 'senthamizh dhevi r', 'ROHITH M', 'praveenkumar m'] },
  { id: 'TECH-707204', name: 'AVENGERS_', pass: 'Avengers1234', members: ['David Paul', 'DALBERT JOE', 'THANA KISHOR', 'vijayendraraj'] },
  { id: 'TECH-357746', name: 'TEAM-ALOK-', pass: 'Tharun@8392', members: ['Arunkumar R', 'Pachaiyappan R', 'MATHESH Kumar J', 'RAJAGUGAN C'] },
  { id: 'TECH-680807', name: 'TEAM-TITANS-', pass: '8019253', members: ['MUNGARA MANASVI', 'Shalini', 'Hasini.k'] },
  { id: 'TECH-832043', name: 'NEURO-TECH', pass: '25102007', members: ['Mariyam.E', 'Karthigeyan.R', 'Karthikeyan.m'] },
  { id: 'TECH-897208', name: 'POWER-HOUSE', pass: 'SPIHER-2006', members: ['RAGEYL MATHEW R', 'M. KAMALESH', 'TAMIL VANAN E', 'DEVA S'] },
  { id: 'TECH-463559', name: 'ADENGAPPA-4-PERU', pass: '90709', members: ['Ragul s', 'Prasanna k', 'Nitheeshwar R', 'MUGUNTHAN S'] },
  { id: 'TECH-405839', name: 'THE-RED-CHIP', pass: 'pEFR9BrW8wvu2rE', members: ['Naveen das. r', 'Thulasi Ram N', 'Sujitha R', 'Soumiyaa.P'] },
  { id: 'TECH-534220', name: 'BOLLA-DEEPAK', pass: '806', members: ['Bolla Deepak'] },
  { id: 'TECH-875524', name: 'NEXUS-AI', pass: 'nexus@2026', members: ['Swetha A', 'Sivasakari K', 'ROSY JENIFER C', 'Rajarathinam s'] },
  { id: 'TECH-518801', name: 'HACKOHOLICSS', pass: 'vasanth.s17', members: ['VASANTHAKUMAR', 'NISMA FATHIMA', 'POVIARASU', 'KATHIR DEV'] },
  { id: 'TECH-170133', name: '404-NOT-FOUND', pass: 'legenddharani', members: ['Dharanipriyan I', 'Dinesh P', 'Gokul', 'Abubakkar Siddique'] },
  { id: 'TECH-610614', name: 'GENERATIVE-AI', pass: 'kaavi@2008', members: ['Rajsri M', 'Monika S', 'Kaaviarasen. S', 'Anisha. S'] },
  { id: 'TECH-670200', name: 'NAANGA-NAALU-PERU', pass: 'Kalai@2007', members: ['Srinath Kalaiselvan', 'Halan aristo', 'Infant cyril', 'Elavarasu'] },
  { id: 'TECH-483065', name: 'ALTIORAX', pass: 'PMRR_02', members: ['PREETHI SREE K', 'MOHANA PRIYA D', 'rithyush bala s', 'roshan sherif k p'] },
  { id: 'TECH-299276', name: 'ZORVEX', pass: 'thanu@03', members: ['Thanujashree A', 'Vasiya r', 'AROKIYA PRADEEP F'] },
  { id: 'TECH-748213', name: 'ELITE-CODERS', pass: 'elite@2026', members: ['K gomathi', 'k sindhuja', 'S YUVASHRI'] },
  { id: 'TECH-480695', name: 'ZYNTRIX', pass: 'zyn@1234', members: ['jeevan kumar k', 'javahar k', 'gokulasivanesh m', 'bharathi v'] },
  { id: 'TECH-713654', name: 'TECH-TITANS', pass: '809848', members: ['V.pragadeeshwaran', 'Abilash.s', 'Sathish kumar', 'Dinesh kumar.p'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toUsername(memberName, teamCode, index) {
  // Convert "Thirunavukkarasu.S" → "thirunavukkarasu_s_tech385276_0"
  const base = memberName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  const suffix = teamCode.replace('TECH-', '').toLowerCase();
  return `${base}_${suffix}_${index}`;
}

const AVATAR_COLORS = [
  '#3B82F6','#8B5CF6','#EC4899','#10B981','#F59E0B',
  '#EF4444','#06B6D4','#84CC16','#F97316','#6366F1',
  '#14B8A6','#A855F7','#FB923C','#22D3EE','#4ADE80',
];

// ---------------------------------------------------------------------------
// Main seeder
// ---------------------------------------------------------------------------
async function seedTeams() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');

    // Sync tables (safe alter — won't drop data)
    await sequelize.sync({ alter: false });

    let teamsCreated = 0;
    let teamsSkipped = 0;
    let usersCreated = 0;
    let usersSkipped = 0;

    for (let t = 0; t < TEAMS.length; t++) {
      const td = TEAMS[t];
      const avatarColor = AVATAR_COLORS[t % AVATAR_COLORS.length];

      // ── Create or find Team ──────────────────────────────────────────────
      const [team, teamCreated] = await Team.findOrCreate({
        where: { teamCode: td.id },
        defaults: {
          name: td.name,
          loginPassword: td.pass,
          status: 'active',
          avatarColor,
        },
      });

      if (teamCreated) {
        teamsCreated++;
        console.log(`  + Team created : ${td.id}  ${td.name}`);
      } else {
        teamsSkipped++;
        console.log(`  ~ Team exists  : ${td.id}  ${td.name}`);
      }

      // ── Create member Users + TeamMember records ──────────────────────────
      for (let i = 0; i < td.members.length; i++) {
        const memberName = td.members[i].trim();
        if (!memberName) continue;

        const username = toUsername(memberName, td.id, i);
        const email    = `${username}@aiz.local`;

        // findOrCreate can't call setPassword (async) before INSERT, so do it manually
        let user = await User.findOne({ where: { username } });
        const userCreated = !user;
        if (userCreated) {
          user = User.build({ username, email, role: 'team_member', isActive: true });
          await user.setPassword(td.pass);
          await user.save();
          usersCreated++;
        } else {
          usersSkipped++;
        }

        // Link user → team (idempotent)
        await TeamMember.findOrCreate({
          where: { teamId: team.id, userId: user.id },
          defaults: {
            roleInTeam: i === 0 ? 'leader' : 'member',
            isActive: true,
          },
        });
      }
    }

    console.log('\n======================================');
    console.log(` Teams  created: ${teamsCreated}   skipped: ${teamsSkipped}`);
    console.log(` Users  created: ${usersCreated}   skipped: ${usersSkipped}`);
    console.log(' Seeding complete ✓');
    console.log('======================================\n');

  } catch (err) {
    console.error('Seeding failed:', err);
    if (require.main === module) process.exit(1);
  } finally {
    // Only close the connection when running standalone (not when embedded in app.js)
    if (require.main === module) await sequelize.close();
  }
}

// Export for use as a module (called from app.js after server starts)
module.exports = { run: seedTeams };

// Auto-run only when invoked directly: node src/seed_teams.js
if (require.main === module) {
  seedTeams();
}
