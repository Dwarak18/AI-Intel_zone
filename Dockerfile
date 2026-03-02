# ==============================================================================
# AI INTELLIGENCE ZONE — Control Arena
# Node.js Multi-Stage Dockerfile
# ==============================================================================

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: non-root user
RUN addgroup -S arena && adduser -S arena -G arena

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/     ./src/
COPY views/   ./views/
COPY static/  ./static/
COPY package.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R arena:arena /app

USER arena

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "src/app.js"]
