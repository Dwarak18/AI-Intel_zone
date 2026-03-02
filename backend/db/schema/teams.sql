-- =============================================================================
-- AI INTELLIGENCE ZONE — Control Arena
-- Table: teams
-- Compatible: SQLite / PostgreSQL
-- =============================================================================

CREATE TABLE IF NOT EXISTS teams (
    id                    VARCHAR(36)    PRIMARY KEY,
    team_code             VARCHAR(20)    UNIQUE NOT NULL,
    name                  VARCHAR(100)   NOT NULL,
    institution           VARCHAR(200),

    -- Admin-visible plaintext credential for distributing to participants
    login_password        VARCHAR(255),

    status                VARCHAR(20)    NOT NULL DEFAULT 'active',
    -- status: 'active' | 'locked' | 'disqualified'
    disqualification_reason TEXT,
    avatar_color          VARCHAR(7)     DEFAULT '#3B82F6',

    -- ── Scoring ──────────────────────────────────────────────────
    total_score           REAL           DEFAULT 0.0,
    bonus_points          REAL           DEFAULT 0.0,
    missions_completed    INTEGER        DEFAULT 0,
    total_submissions     INTEGER        DEFAULT 0,
    successful_validations INTEGER       DEFAULT 0,
    failed_validations    INTEGER        DEFAULT 0,
    current_rank          INTEGER,

    -- ── Performance Metrics ──────────────────────────────────────
    error_rate            REAL           DEFAULT 0.0,
    hallucination_count   INTEGER        DEFAULT 0,
    avg_response_time     REAL           DEFAULT 0.0,
    health_score          REAL           DEFAULT 100.0,

    -- ── Timestamps ───────────────────────────────────────────────
    last_activity_at      DATETIME,
    created_at            DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_status        ON teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_current_rank  ON teams(current_rank);
CREATE INDEX IF NOT EXISTS idx_teams_total_score   ON teams(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_teams_last_activity ON teams(last_activity_at);
