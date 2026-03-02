// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Express Application Entry Point
// ==============================================================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const { Server } = require('socket.io');

const expressLayouts = require('express-ejs-layouts');
const config = require('./config');
const { sequelize } = require('./models');
const { initSockets } = require('./sockets');

// Route imports
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api');
const teamRouter = require('./routes/team');

// Auth middleware init
require('./authMiddleware');

// ==============================================================================
// APP & SERVER SETUP
// ==============================================================================
const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
initSockets(io);
app.set('io', io);

// ==============================================================================
// VIEW ENGINE
// ==============================================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../frontend/views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// ==============================================================================
// SECURITY & MIDDLEWARE
// ==============================================================================
// Whitelist the Vercel static CDN host in CSP if STATIC_CDN_URL is configured
const _cdnHost = config.staticCdnUrl ? new URL(config.staticCdnUrl).hostname : null;
const _cdnSrc  = _cdnHost ? [_cdnHost] : [];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', ..._cdnSrc],
      styleSrc:    ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', ..._cdnSrc],
      fontSrc:     ["'self'", 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', ..._cdnSrc],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'", 'ws:', 'wss:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.corsOrigins || '*',
  credentials: true,
}));

app.use(morgan(config.isDevelopment ? 'dev' : 'combined'));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimitRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    error: 'Too many requests. Please slow down.',
    retryAfter: 60,
  }),
});
app.use('/api', globalLimiter);

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.submitRateLimitPerMinute,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => res.status(429).json({
    error: 'Submission rate limit reached. Max submissions per minute exceeded.',
    retryAfter: 60,
  }),
});
app.use('/api/submit', submitLimiter);

// ==============================================================================
// REQUEST PARSING
// ==============================================================================
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ==============================================================================
// SESSION
// ==============================================================================
app.use(session({
  secret: config.secretKey,
  resave: false,
  saveUninitialized: false,
  name: 'arena_session',
  cookie: {
    secure: config.isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
  },
}));

// ==============================================================================
// PASSPORT
// ==============================================================================
app.use(passport.initialize());
app.use(passport.session());

// ==============================================================================
// FLASH MESSAGES
// ==============================================================================
app.use(flash());

// Make user and currentPath available to all templates
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.currentPath = req.path;
  // Empty string → relative /static/... path (dev + Railway direct)
  // Vercel CDN URL → https://your-app.vercel.app/static/...
  res.locals.staticUrl = config.staticCdnUrl || '';
  next();
});

// ==============================================================================
// REQUEST TIMING MIDDLEWARE
// ==============================================================================
app.use((req, res, next) => {
  req._startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - req._startTime;
    if (duration > 2000) {
      console.warn(`SLOW REQUEST: ${req.method} ${req.path} — ${duration}ms`);
    }
  });
  next();
});

// ==============================================================================
// STATIC FILES
// ==============================================================================
// React production build (served from /app/public after Docker build)
const publicDir = path.join(__dirname, '../public');
if (require('fs').existsSync(publicDir)) {
  app.use(express.static(publicDir));
}
// (legacy static folder removed — React handles static assets)

// ==============================================================================
// HEALTH CHECK (before all other routes)
// ==============================================================================
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ==============================================================================
// ROUTES
// ==============================================================================
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/api', apiRouter);
app.use('/team', teamRouter);

// Root redirect (legacy EJS) — skip if React build exists
app.get('/', (req, res, next) => {
  if (require('fs').existsSync(path.join(__dirname, '../public/index.html'))) return next();
  res.redirect('/auth/login');
});

// SPA catch-all — serve React index.html for all non-API routes
app.get('*', (req, res, next) => {
  const excluded = ['/api', '/auth', '/admin', '/team', '/static'];
  if (excluded.some(p => req.path.startsWith(p))) return next();
  const idx = path.join(__dirname, '../public/index.html');
  if (require('fs').existsSync(idx)) return res.sendFile(idx);
  return next();
});

// ==============================================================================
// ERROR HANDLERS
// ==============================================================================
app.use((req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/admin') || req.path.startsWith('/team')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).send('<html><body style="background:#020617;color:#e2e8f0;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div><h1 style="color:#6366f1">404</h1><p>Page not found</p><a href="/" style="color:#6366f1">Go home →</a></div></body></html>');
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/admin') || req.path.startsWith('/team')) {
    return res.status(status).json({ error: err.message || 'Internal server error' });
  }
  res.status(status).send('<html><body style="background:#020617;color:#e2e8f0;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div><h1 style="color:#ef4444">500</h1><p>Server error</p></div></body></html>');
});

// ==============================================================================
// DATABASE SYNC & STARTUP
// ==============================================================================
async function ensureAdminUser() {
  try {
    const { User } = require('./models');
    let admin = await User.findOne({ where: { username: config.adminUsername } });
    if (!admin) {
      console.log('Creating default admin user...');
      admin = User.build({
        username: config.adminUsername,
        email: 'admin@controllarena.local',
        role: 'admin',
        isActive: true,
      });
      await admin.setPassword(config.adminPassword);
      await admin.save();
      console.log(`Admin created: ${config.adminUsername}`);
    }
  } catch (err) {
    console.warn('Could not ensure admin user:', err.message);
  }
}

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // PostgreSQL supports ALTER TABLE natively — no backup-table issue like SQLite.
    await sequelize.sync({ alter: true });
    console.log('Database synced.');

    await ensureAdminUser();

    const port = config.port;
    server.listen(port, '0.0.0.0', async () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(` AI INTELLIGENCE ZONE — Control Arena`);
      console.log(` Server running at http://0.0.0.0:${port}`);
      console.log(` Environment: ${config.isDevelopment ? 'development' : 'production'}`);
      console.log(` Database: ${config.databaseUrl}`);
      console.log(`${'='.repeat(60)}\n`);

      // Run seeders after server is listening so healthcheck passes immediately
      try {
        await require('./seed').run();
        await require('./seed_teams').run();
      } catch (seedErr) {
        console.warn('Seeder warning (non-fatal):', seedErr.message);
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server };
