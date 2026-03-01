# AI INTELLIGENCE ZONE – Control Arena

Production-grade AI competition platform for live college events.

Built with Flask, PostgreSQL, Redis, Celery, and Nginx. Includes a modern dark-theme admin panel, live leaderboard, team management, activity monitoring, AI log inspection, and security/audit layers.

---

## Features

- Admin mission-control dashboard with live stats
- Team and member management (lock/unlock, disqualify, score override)
- Mission management with schema/field expectations
- AI response validation pipeline (JSON/schema/type/regex/field checks)
- Real-time leaderboard updates (polling-based)
- AI logs viewer with split-pane prompt/output detail
- Security event tracking + audit trail exports
- Celery-based background jobs (rank recalculation, anomaly checks)
- Dockerized production stack with reverse proxy

---

## Tech Stack

- Backend: Flask, Flask-SQLAlchemy, Flask-Login, Flask-WTF
- Database: PostgreSQL (production), SQLite (development fallback)
- Cache/Broker: Redis
- Async: Celery + Celery Beat
- Reverse Proxy: Nginx
- Frontend: Jinja templates + Bootstrap 5 + custom CSS/JS
- Validation/Security: jsonschema + custom detection engines

Dependencies: [requirements.txt](requirements.txt)

---

## Project Structure

- [app.py](app.py): Flask app factory and bootstrap
- [config.py](config.py): environment configs
- [models.py](models.py): all database models
- [security.py](security.py): RBAC, detection, auditing utilities
- [validation_engine.py](validation_engine.py): validation pipeline
- [scoring_engine.py](scoring_engine.py): scoring and ranking logic
- [celery_worker.py](celery_worker.py): async/background jobs
- [routes/admin.py](routes/admin.py): admin panel + admin APIs
- [routes/api.py](routes/api.py): competition/team APIs
- [routes/auth.py](routes/auth.py): session + token auth
- [templates](templates): server-rendered frontend
- [static/css/arena.css](static/css/arena.css): global UI theme
- [static/js/core.js](static/js/core.js): shared frontend utilities
- [docker-compose.yml](docker-compose.yml): full production stack
- [Dockerfile](Dockerfile): app container build
- [nginx/nginx.conf](nginx/nginx.conf): reverse proxy config
- [seed.py](seed.py): demo seed data

Architecture notes: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Quick Start (Local)

### Option A — Fast local script

Use [start.sh](start.sh). It creates a virtual env, installs dependencies, optionally seeds data, and runs the app.

### Option B — Manual

1. Create and activate a virtual environment
2. Install dependencies from [requirements.txt](requirements.txt)
3. Copy [.env.example](.env.example) to `.env`
4. (Optional) seed sample data with [seed.py](seed.py)
5. Run [app.py](app.py)

Default local URL: `http://localhost:5000`

Admin login (seed/default):
- Username: `arena_admin`
- Password: `ChangeMe@2026!`

---

## Production Deployment (Docker)

Use [docker-compose.yml](docker-compose.yml), which includes:

- `app` (Flask + Gunicorn)
- `postgres`
- `redis`
- `nginx`
- `celery-worker`
- `celery-beat`

Before starting:

1. Set strong secrets in `.env`
2. Set `FLASK_ENV=production`
3. Configure domain/SSL certs for Nginx

Then run with Docker Compose and verify:

- App health endpoint: `/api/health`
- Admin login endpoint: `/auth/login`

Entrypoint/bootstrap logic: [entrypoint.sh](entrypoint.sh)

---

## Core Workflows

### Submission Flow

1. Team submits prompt to API
2. Security checks run (injection/tamper heuristics)
3. Validation engine processes AI output
4. Score engine computes mission and bonus scores
5. Submission + AI logs + team metrics are persisted
6. Rankings refresh

### Admin Live Monitoring

- Dashboard pulls periodic updates from admin APIs
- Activity feed updates every few seconds
- Leaderboard refreshes continuously
- Logs view loads heavy details on demand

---

## API Overview

Public/admin-facing routes include:

- Health: `/api/health`
- Leaderboard: `/api/leaderboard`
- Submit: `/api/submit`
- Admin stats feed: `/admin/api/stats`
- Admin activity feed: `/admin/api/activity_feed`
- Admin analytics feed: `/admin/api/analytics`
- Admin log detail: `/admin/api/logs/<log_id>`

Most team APIs require token auth.

---

## Security Notes

- Input validation and schema checks on submissions
- Role-based protection on admin routes
- Security event logging and audit trail
- Nginx security headers + rate limiting
- Log payload size capping for performance/safety

Important: rotate all default credentials and secrets before public deployment.

---

## Performance Notes

- Pagination on heavy tables/log views
- Polling-based live updates (no hard websocket dependency)
- Lazy-loading log detail content
- Background workers for periodic and heavy tasks

---

## Launch Checklist

- [ ] `.env` is set with production secrets
- [ ] DB credentials and network access are restricted
- [ ] SSL certs configured in Nginx
- [ ] Default admin password changed
- [ ] Seed/demo data removed (if not needed)
- [ ] `/api/health` returns operational
- [ ] Celery worker and beat are both healthy
- [ ] Backup policy for PostgreSQL is enabled

---

## License

Set your preferred license for your organization/event before open distribution.

# ai-zone
