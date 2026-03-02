# AI INTELLIGENCE ZONE — Control Arena
## System Architecture (Code-Accurate)
### Version 2.1 | March 2026

---

## 1) What this system is

Control Arena is a Flask monolith for AI competition events. It provides:

- Admin operations UI (server-rendered)
- Team member web login + mission console
- Token-authenticated REST APIs
- Validation and scoring engines
- Security + audit/event logging
- Background jobs (Celery worker + beat)

This document reflects the current repository implementation, not a future target design.

---

## 2) High-level architecture

```text
Client Browser
 ├─ Admin Login/UI (Jinja templates)
 └─ Team Login/UI (Jinja templates)
          │
          ▼
      Nginx (optional, in Docker deployment)
          │
          ▼
      Flask App (app.py)
        ├─ Auth routes (session + JWT)
        ├─ Admin routes (dashboard, teams, logs, security)
        ├─ Team routes (mission console page)
        └─ API routes (submit, missions, leaderboard, team data)
          │
          ├─ SQLAlchemy → PostgreSQL (prod) / SQLite (dev)
          └─ Redis (rate limit/session infra + Celery broker/backend)

Background:
  Celery Worker + Celery Beat
    ├─ Ranking recalculation
    ├─ Health score updates
    ├─ Cleanup tasks
    └─ Anomaly/report tasks
```

---

## 3) Code topology

- App bootstrap: [app.py](app.py)
- Configs: [config.py](config.py)
- DB models: [models.py](models.py)
- Security utilities/decorators: [security.py](security.py)
- Validation pipeline: [validation_engine.py](validation_engine.py)
- Scoring engine: [scoring_engine.py](scoring_engine.py)
- Celery tasks: [celery_worker.py](celery_worker.py)

Routes:

- Auth: [routes/auth.py](routes/auth.py)
- Admin UI + admin APIs: [routes/admin.py](routes/admin.py)
- Team APIs: [routes/api.py](routes/api.py)
- Team web portal pages: [routes/team.py](routes/team.py)

Templates/UI:

- Base admin layout: [templates/base.html](templates/base.html)
- Admin pages: [templates/admin](templates/admin)
- Admin login: [templates/auth/login.html](templates/auth/login.html)
- Team login: [templates/auth/team_login.html](templates/auth/team_login.html)
- Team console: [templates/team/mission_console.html](templates/team/mission_console.html)
- Team layout: [templates/team/base.html](templates/team/base.html)

Client JS:

- Shared UI helpers: [static/js/core.js](static/js/core.js)
- Admin scripts: [static/js/dashboard.js](static/js/dashboard.js), [static/js/leaderboard.js](static/js/leaderboard.js), [static/js/logs.js](static/js/logs.js)
- Team console integration: [static/js/team_console.js](static/js/team_console.js)

---

## 4) Authentication and authorization model

### 4.1 Session auth (web)

- Admin login page: `/auth/login`
- Team login page: `/auth/team-login`
- Logout: `/auth/logout`

After login:

- Admin roles (`super_admin`, `admin`, `moderator`) are redirected to admin dashboard.
- Team roles (`team_member`, `team_lead`) are redirected to team mission console.

### 4.2 JWT auth (API)

- Token issue: `POST /auth/api/token`
- Token verify: `POST /auth/api/token/verify`

### 4.3 Hybrid API access

The API decorator accepts:

1. `Authorization: Bearer <jwt>` token, or
2. Active Flask session user (web fallback)

This enables team web pages to call API routes without manual token injection while still supporting pure API clients.

### 4.4 RBAC

- `require_admin`: admin-only pages/actions
- `require_role(...)`: explicit role guards
- `require_team_access`: team ownership checks for team-scoped resources

---

## 5) Core runtime flows

## 5.1 Team web flow

1. Team member logs in at `/auth/team-login`.
2. Browser opens `/team/mission-console`.
3. Team console JS loads available missions from `GET /api/missions`.
4. User submits prompt using `POST /api/submit`.
5. Response updates:
   - JSON preview panel
   - Validation feedback
   - Confidence value
   - Submission history table row

## 5.2 API submission flow

`POST /api/submit` in [routes/api.py](routes/api.py):

1. Parse request JSON
2. Resolve team + mission
3. Injection detection
4. Validation pipeline (parse/schema/type/regex/field/confidence)
5. Hallucination estimation
6. Score calculation
7. Persist `Submission` + `AILog`
8. Update team and mission metrics
9. Optional ranking recalculation
10. Emit structured response payload

---

## 6) Submit payload contract (current)

Primary API form:

```json
{
  "team_id": "<uuid>",
  "mission_id": "<uuid>",
  "prompt_text": "...",
  "ai_response": "..."
}
```

Team console compatibility form:

```json
{
  "prompt": "...",
  "mission_id": "<optional uuid>"
}
```

Compatibility rules currently implemented:

- `prompt` is accepted as alias of `prompt_text`
- If `ai_response` is missing, prompt is reused as response payload
- If `team_id` is missing, it is derived from logged-in team membership
- If `mission_id` is missing, first visible active mission is selected

---

## 7) Validation + scoring architecture

### 7.1 Validation engine

`ValidationEngine.validate(...)` performs staged checks:

1. JSON parse
2. Schema validation (jsonschema)
3. Type enforcement
4. Field count/required fields
5. Regex checks
6. Confidence scoring

Outputs a normalized `ValidationResult` object with status, stage details, warnings/errors, and confidence.

### 7.2 Scoring engine

`ScoringEngine` computes:

- Accuracy component
- Speed component
- Validation component
- Retry penalty
- Bonus checks and achievement grants
- Rank recalculation

Configured weights are sourced from app config/env (`WEIGHT_ACCURACY`, `WEIGHT_SPEED`, `WEIGHT_VALIDATION`).

---

## 8) Security architecture

Main controls:

- Input checks + strict validation
- Prompt injection pattern detection
- Tamper/fingerprint helpers
- Security event logging
- Audit trail for user/admin actions
- Role-based endpoint protection
- Flask-WTF CSRF protection (API blueprints exempted by design)

Important implementation detail:

- Admin and team web sessions are cookie/session based.
- API consumers can use JWT.

---

## 9) Data model summary

Primary entities in [models.py](models.py):

- `User`
- `Team`
- `TeamMember`
- `Mission`
- `Submission`
- `AILog`
- `AuditLog`
- `SecurityEvent`
- `Achievement`
- `ScoreOverride`

Persistence:

- Production default: PostgreSQL URI from `DATABASE_URL`
- Development fallback: SQLite (`sqlite:///control_arena_dev.db`)

---

## 10) Background jobs

Celery in [celery_worker.py](celery_worker.py) runs periodic tasks:

- Ranking recalculation (every 60s)
- Team health score updates (every 5m)
- Session cleanup (hourly)
- Activity report generation (every 15m)
- Anomaly detection (every 2m)

Broker/backend default: Redis database index 1.

---

## 11) Deployment profiles

### 11.1 Local development

- App served directly via Flask
- Usually SQLite for fast local setup
- Optional seed data via [seed.py](seed.py)

### 11.2 Docker compose deployment

Defined in [docker-compose.yml](docker-compose.yml):

- `app` (Flask/Gunicorn image target)
- `postgres`
- `redis`
- `nginx`
- `celery-worker`
- `celery-beat`

No separate React/Next frontend services are defined in current compose.

---

## 12) Current HTTP surface (key routes)

Web:

- `/auth/login`
- `/auth/team-login`
- `/admin/`
- `/team/mission-console`

API:

- `GET /api/health`
- `POST /api/submit`
- `GET /api/leaderboard`
- `GET /api/missions`
- `GET /api/missions/<mission_id>`
- `GET /api/team/<team_id>`
- `GET /api/team/<team_id>/submissions`
- `GET /api/team/<team_id>/achievements`

Auth API:

- `POST /auth/api/token`
- `POST /auth/api/token/verify`

---

## 13) Known gaps / roadmap suggestions

1. Team console currently reuses prompt text as response when `ai_response` is absent; consider explicit AI invocation pipeline.
2. Add stronger API contract versioning for backward compatibility.
3. Add automated integration tests for team web submit path.
4. Add centralized structured logging to file/collector in production.
5. Harden default credential/secret posture for non-dev environments.

---

## 14) Quick operator notes

- Health check: `/api/health`
- Admin default (seed/dev): `arena_admin / ChangeMe@2026!`
- Team login page: `/auth/team-login`
- Team console page: `/team/mission-console`

This file should be treated as the source-of-truth architecture summary for external tools and reviewers.
# AI INTELLIGENCE ZONE — Control Arena
## Production-Grade System Architecture Document
### Version 2.0 | March 2026

---

## 1. SYSTEM ARCHITECTURE DIAGRAM

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        AI INTELLIGENCE ZONE — CONTROL ARENA                      │
│                           Production Architecture v2.0                            │
└──────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   CLOUDFLARE    57  │
                              │   WAF + DDoS    │
                              │   Protection    │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │   NGINX REVERSE  │
                              │   PROXY + SSL    │
                              │   Rate Limiter   │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
           ┌────────▼──────┐  ┌───────▼───────┐  ┌──────▼───────┐
           │  ADMIN PANEL  │  │  TEAM PORTAL  │  │  PUBLIC      │
           │  (React/Next) │  │  (React SPA)  │  │  LEADERBOARD │
           │  Port 3000    │  │  Port 3001    │  │  Port 3002   │
           └────────┬──────┘  └───────┬───────┘  └──────┬───────┘
                    │                 │                  │
                    └─────────────────┼──────────────────┘
                                      │
                              ┌───────▼───────┐
                              │   API GATEWAY  │
                              │   Flask App    │
                              │   Port 5000    │
                              │   ┌─────────┐  │
                              │   │  Auth    │  │
                              │   │  Middle  │  │
                              │   │  ware    │  │
                              │   └─────────┘  │
                              └───────┬───────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
     ┌────────▼──────┐      ┌────────▼──────┐      ┌────────▼──────┐
     │  CORE ENGINE  │      │  AI VALIDATION│      │  SECURITY     │
     │               │      │  ENGINE       │      │  ENGINE       │
     │ • Team Mgmt   │      │               │      │               │
     │ • Missions    │      │ • JSON Schema │      │ • Injection   │
     │ • Scoring     │      │ • Regex Valid  │      │   Detection   │
     │ • Leaderboard │      │ • Type Check  │      │ • Rate Limit  │
     │ • Submissions │      │ • Confidence  │      │ • Audit Log   │
     └────────┬──────┘      └────────┬──────┘      └────────┬──────┘
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
           ┌────────▼──────┐ ┌───────▼───────┐ ┌──────▼───────┐
           │  PostgreSQL   │ │    Redis      │ │  InfluxDB    │
           │  Primary DB   │ │  Cache +      │ │  (PLANNED)   │
           │               │ │  Sessions +   │ │  Time Series │
           │ • Teams       │ │  Pub/Sub      │ │              │
           │ • Users       │ │               │ │ • Latency    │
           │ • Missions    │ │ • Leaderboard │ │ • Throughput │
           │ • Submissions │ │ • Rate Limits │ │ • Error Rate │
           │ • Audit Logs  │ │ • Live Feed   │ │ • Anomalies  │
           └───────────────┘ └───────────────┘ └──────────────┘
                    │
           ┌────────▼──────┐
           │  BACKUP       │
           │  S3/MinIO     │
           │               │
           │ • DB Dumps    │
           │ • Audit Logs  │
           │ • Exports     │
           └───────────────┘

    ┌──────────────────────────────────────────────────┐
    │              REAL-TIME LAYER                      │
    │                                                   │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
    │  │ Socket.IO│  │ SSE Feed │  │ WebHooks │       │
    │  │          │  │          │  │          │       │
    │  │ Live     │  │ Leader-  │  │ Alert    │       │
    │  │ Activity │  │ board    │  │ Notifs   │       │
    │  │ Monitor  │  │ Stream   │  │          │       │
    │  └──────────┘  └──────────┘  └──────────┘       │
    └──────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────┐
    │        OBSERVABILITY STACK (PLANNED — not in compose) │
    │                                                   │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
    │  │Prometheus│  │ Grafana  │  │ Sentry   │       │
    │  │ Metrics  │  │ Dashbrd  │  │ Error    │       │
    │  │          │  │          │  │ Tracking │       │
    │  └──────────┘  └──────────┘  └──────────┘       │
    └──────────────────────────────────────────────────┘
```

---

## 2. DATA FLOW DIAGRAM

```
TEAM SUBMITS PROMPT
        │
        ▼
┌───────────────┐     ┌───────────────┐
│ Rate Limiter  │────▶│ Auth Check    │
│ (Redis Token  │     │ (JWT + RBAC)  │
│  Bucket)      │     └───────┬───────┘
└───────────────┘             │
                              ▼
                    ┌───────────────┐
                    │ Injection     │
                    │ Detection     │
                    │ Engine        │
                    └───────┬───────┘
                            │
                   CLEAN ───┤──── FLAGGED
                     │              │
                     ▼              ▼
              ┌────────────┐ ┌────────────┐
              │ AI Process │ │ Quarantine │
              │ Pipeline   │ │ + Alert    │
              └─────┬──────┘ └────────────┘
                    │
                    ▼
           ┌───────────────┐
           │ Response      │
           │ Validation    │
           │ Engine        │
           │               │
           │ 1. JSON Parse │
           │ 2. Schema     │
           │ 3. Type Check │
           │ 4. Regex      │
           │ 5. Confidence │
           └───────┬───────┘
                   │
          PASS ────┤──── FAIL
            │              │
            ▼              ▼
     ┌────────────┐ ┌────────────┐
     │ Score      │ │ Error Log  │
     │ Calculator │ │ + Retry    │
     │ + Board    │ │ Counter    │
     └────────────┘ └────────────┘
            │
            ▼
     ┌────────────┐
     │ Leaderboard│
     │ Cache      │
     │ Invalidate │
     └────────────┘
```

---

## 3. TECH STACK

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Backend API** | Flask + Flask-SocketIO | Lightweight, extensible, real-time capable |
| **Database** | PostgreSQL 16 | ACID compliance, JSON support, robust |
| **Cache** | Redis 7 | Leaderboard, sessions, rate limiting, pub/sub |
| **Time-Series** | InfluxDB | Activity metrics, anomaly detection — **planned, not deployed** |
| **Task Queue** | Celery + Redis | Async scoring, batch exports, alerts |
| **Admin Frontend** | HTML/CSS/JS (Jinja2) | Server-rendered, fast, no build step needed |
| **Real-Time** | Socket.IO | Bi-directional, fallback to polling |
| **Auth** | JWT + Flask-Login | Stateless API auth + session admin |
| **Validation** | jsonschema + custom | Schema enforcement, regex, type checking |
| **Security** | Custom middleware | Injection detection, RBAC, audit trail |
| **Monitoring** | Prometheus + Grafana | Metrics, dashboards, alerting — **planned, not in current docker-compose** |
| **Error Tracking** | Sentry | Production error capture — **planned, not in current docker-compose** |
| **Containerization** | Docker + Compose | Reproducible deployment |
| **Reverse Proxy** | Nginx | SSL termination, rate limiting |
| **Backup** | pg_dump + S3/MinIO | Scheduled backups, log archival |

---

## 4. SECURITY STRATEGY

### 4.1 Defense-in-Depth Model

```
Layer 1: Network     → Nginx rate limit, IP whitelist, SSL/TLS
Layer 2: Application → JWT auth, RBAC, CORS, CSRF protection
Layer 3: Logic       → Input validation, injection detection, schema enforcement
Layer 4: Data        → Encrypted at rest, parameterized queries, audit logs
Layer 5: Monitoring  → Anomaly detection, real-time alerts, tamper detection
```

### 4.2 Prompt Injection Detection

The system uses a multi-layered approach:

1. **Pattern Matching**: Known injection patterns (ignore instructions, system prompt leaks)
2. **Entropy Analysis**: Unusually high entropy strings flagged
3. **Length Anomaly**: Prompts exceeding statistical norms flagged
4. **Frequency Analysis**: Rapid-fire submissions detected and throttled
5. **Semantic Similarity**: Repeated near-identical prompts flagged
6. **Nested Command Detection**: SQL, OS command, path traversal patterns

### 4.3 Rate Limiting Strategy

| Endpoint | Window | Max Requests | Burst |
|----------|--------|-------------|-------|
| `/api/submit` | 60s | 10 | 3 |
| `/api/leaderboard` | 10s | 30 | 10 |
| `/api/team/*` | 60s | 20 | 5 |
| `/admin/*` | 60s | 100 | 20 |

### 4.4 Audit Trail

Every action is logged with:
- Timestamp (UTC, microsecond precision)
- Actor (user_id, team_id, role)
- Action type
- Resource affected
- IP address
- User agent
- Request payload hash
- Response status
- Geo-location (from IP)

---

## 5. LEADERBOARD SCORING ALGORITHM

### 5.1 Base Score Formula

```
Mission_Score = (Accuracy × W_acc) + (Speed_Bonus × W_spd) + (Validation_Rate × W_val)

Where:
  W_acc = 0.50  (50% weight — correctness is king)
  W_spd = 0.20  (20% weight — faster completion rewarded)
  W_val = 0.30  (30% weight — clean, valid responses matter)
```

### 5.2 Accuracy Score (0-100)

```
Accuracy = (Correct_Fields / Total_Fields) × 100
         × Schema_Compliance_Multiplier
         × Confidence_Score

Schema_Compliance_Multiplier:
  1.0 = Perfect schema match
  0.8 = Minor deviations (extra fields)
  0.5 = Major deviations (missing required fields)
  0.0 = Invalid JSON / unparseable
```

### 5.3 Speed Bonus (0-100)

```
Speed_Bonus = max(0, 100 - ((Time_Taken / Time_Limit) × 100))

With decay: Speed_Bonus × e^(-λ × attempts)
Where λ = 0.1 (penalizes excessive retries)
```

### 5.4 Validation Rate (0-100)

```
Validation_Rate = (Successful_Validations / Total_Submissions) × 100
```

### 5.5 Bonus Scoring

| Bonus Type | Points | Condition |
|-----------|--------|-----------|
| First Blood | +50 | First team to complete a mission |
| Perfect Parse | +25 | Zero validation errors on first try |
| Speed Demon | +30 | Complete in under 25% of time limit |
| Consistency | +20 | 5 consecutive valid submissions |
| Zero Error | +40 | Complete all missions with 0 errors |
| Efficient Prompt | +15 | Prompt ≤ 200 chars **and** confidence ≥ 0.95 (auto-awarded) |

### 5.6 Tie-Break Logic

```
Priority Order:
1. Total score (highest wins)
2. Fewer total submissions (efficiency)
3. Earlier final submission timestamp
4. Higher average confidence score
5. Lower hallucination rate
6. Admin manual override (last resort)
```

### 5.7 Anti-Gaming Measures

- Exponential decay on retry scores
- Minimum time between submissions enforced
- Copy-paste detection across teams
- Statistical outlier detection (impossibly fast/perfect)
- Admin can freeze scores pending investigation

---

## 6. CREATIVE ENHANCEMENTS

### 6.1 🎮 Live Battle Mode
Real-time head-to-head mission where two teams race simultaneously, visible to all on the projector dashboard.

### 6.2 🧠 Hallucination Heatmap
Visual heatmap showing which parts of AI responses tend to hallucinate across all teams — valuable research data.

### 6.3 🏆 Achievement System
Unlock badges: "JSON Ninja", "Speed Demon", "Zero Error Streak", "Comeback King" — displayed on team profiles.

### 6.4 📊 Team Health Score
Composite metric combining activity, error rate, submission quality, and participation — visible to admins for early intervention.

### 6.5 🔍 Forensic Replay
Admin can replay a team's entire session chronologically — every prompt, response, validation — like a DVR for debugging disputes.

### 6.6 🚨 Smart Alert System
ML-based anomaly detection alerts admins when:
- A team's behavior deviates from baseline
- Submission patterns suggest automation
- Score jumps are statistically improbable

### 6.7 📡 Spectator Mode
Public-facing dashboard for audience engagement showing live stats, top teams, and activity feed without sensitive data.

### 6.8 🧪 Sandbox Mode
Pre-competition practice environment where teams can test prompts without affecting scores or leaderboard.

---

## 7. DEPLOYMENT STRATEGY

### 7.1 Docker Compose Stack

> **Actual services in `docker-compose.yml`** — do not add observability services (InfluxDB, Prometheus, Grafana)
> until they are explicitly provisioned.

```
services:
  nginx          → Reverse proxy + SSL termination
  app            → Flask application (Gunicorn in prod)
  celery-worker  → Async task worker
  celery-beat    → Scheduled tasks (cleanup, rankings, health)
  postgres       → Primary database (SQLAlchemy models)
  redis          → Celery broker + rate-limit / session store
```

**Horizontal scaling note:** To run multiple app replicas set
`replicas: N` on the `app` service and point a HAProxy/Nginx upstream
at each container. Celery workers scale independently — add workers
by duplicating the `celery-worker` service definition with a new name.
No code changes are required; workers autodiscover tasks via Redis.

**Observability (planned, not yet deployed):**
```
  influxdb       → Time-series activity metrics    (add when ready)
  prometheus     → Scrape /metrics from Flask app  (add when ready)
  grafana        → Dashboards backed by Prometheus  (add when ready)
  sentry-sdk     → Error tracking (pip install, set SENTRY_DSN env)  (add when ready)
```

### 7.2 Known Tech Debt

| Item | Priority | Notes |
|---|---|---|
| `User.query.get()` calls | Low | SQLAlchemy 2.0 legacy; replace with `db.session.get(User, id)` |
| `Team.query.get()` / `Mission.query.get()` | Low | Same as above |
| JWT_SECRET_KEY min 32 bytes | Medium | Enforce in `config.py` with `assert len(...) >= 32` |
| No `/` root route | Low | Redirect to `/auth/login` or `/auth/team-login` |
| No integration test for team web session login | Medium | Add to `tests/test_smoke.py` |
| Socket.IO in requirements but not wired | Low | Remove or implement for live leaderboard |

### 7.3 Pre-Competition Checklist

- [ ] Load test with 150+ simulated teams
- [ ] Verify all rate limits under stress
- [ ] Test failover scenarios
- [ ] Verify backup/restore cycle
- [ ] Security audit (injection tests)
- [ ] Admin panel walkthrough
- [ ] Emergency shutdown procedure documented
- [ ] Network isolation verified
- [ ] Clock synchronization confirmed (NTP)
- [ ] Emergency contact list distributed
