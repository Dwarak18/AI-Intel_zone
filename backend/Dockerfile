# ==============================================================================
# AI INTELLIGENCE ZONE — Control Arena
# Node.js + React Multi-Stage Dockerfile
# ==============================================================================

# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build
# Build output lands in /frontend/dist (vite outDir: 'dist')

# ── Stage 2: Backend dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: non-root user
RUN addgroup -S arena && adduser -S arena -G arena

WORKDIR /app

# Copy production node_modules
COPY --from=deps --chown=arena:arena /app/node_modules ./node_modules

# Copy React build → served by Express as /app/public
COPY --from=frontend-build --chown=arena:arena /frontend/dist ./public

# Copy backend source
COPY --chown=arena:arena backend/src/        ./src/
COPY --chown=arena:arena backend/package.json ./

# Copy EJS views and legacy static assets (admin portal)
COPY --chown=arena:arena frontend/views/     ./views/
COPY --chown=arena:arena frontend/static/    ./static/

# Data directory
RUN mkdir -p /app/data && chown arena:arena /app/data

USER arena

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD node -e "require('http').get('http://localhost:5000/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "src/app.js"]

