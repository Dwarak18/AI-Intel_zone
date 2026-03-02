# ==============================================================================
# AI INTELLIGENCE ZONE — Control Arena
# Node.js Multi-Stage Dockerfile
# ==============================================================================

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: non-root user
RUN addgroup -S arena && adduser -S arena -G arena

WORKDIR /app

# Copy compiled production node_modules from deps stage
COPY --from=deps --chown=arena:arena /app/node_modules ./node_modules

# Copy application source
COPY --chown=arena:arena backend/src/        ./src/
COPY --chown=arena:arena frontend/views/     ./views/
COPY --chown=arena:arena frontend/static/    ./static/
COPY --chown=arena:arena backend/package.json ./

# Data directory for optional local SQLite usage
RUN mkdir -p /app/data && chown arena:arena /app/data

USER arena

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "src/app.js"]
