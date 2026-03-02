-- =============================================================================
-- AI INTELLIGENCE ZONE — Control Arena
-- Table: submissions
-- Compatible: SQLite / PostgreSQL
-- =============================================================================

CREATE TABLE IF NOT EXISTS submissions (
    id                  VARCHAR(36)    PRIMARY KEY,
    team_id             VARCHAR(36)    NOT NULL REFERENCES teams(id),
    mission_id          VARCHAR(36)    NOT NULL REFERENCES missions(id),
    submitted_by        VARCHAR(36)    REFERENCES users(id),
    attempt_number      INTEGER        NOT NULL DEFAULT 1,

    -- ── Input / Output ────────────────────────────────────────────
    prompt_text         TEXT           NOT NULL,
    ai_raw_response     TEXT,
    parsed_response     TEXT,

    -- ── Validation Results ────────────────────────────────────────
    validation_status   VARCHAR(20)    NOT NULL DEFAULT 'pending',
    -- status: 'valid' | 'invalid' | 'error' | 'pending'
    json_valid          BOOLEAN,
    schema_valid        BOOLEAN,
    type_check_valid    BOOLEAN,
    regex_valid         BOOLEAN,
    field_count_valid   BOOLEAN,
    validation_errors   TEXT,          -- JSON array of error strings

    -- ── Scores ───────────────────────────────────────────────────
    accuracy_score      REAL           DEFAULT 0.0,
    speed_score         REAL           DEFAULT 0.0,
    validation_score    REAL           DEFAULT 0.0,
    confidence_score    REAL           DEFAULT 0.0,
    total_score         REAL           DEFAULT 0.0,
    bonus_awarded       REAL           DEFAULT 0.0,
    bonus_type          VARCHAR(50),

    -- ── Telemetry ─────────────────────────────────────────────────
    response_time_ms    INTEGER,
    prompt_length       INTEGER,
    response_length     INTEGER,
    ip_address          VARCHAR(45),
    user_agent          VARCHAR(500),

    -- ── Security Flags ────────────────────────────────────────────
    is_flagged          BOOLEAN        DEFAULT 0,
    flag_reason         VARCHAR(200),
    injection_detected  BOOLEAN        DEFAULT 0,
    is_hallucinated     BOOLEAN        DEFAULT 0,

    -- ── Timestamps ───────────────────────────────────────────────
    created_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_team_id         ON submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_mission_id      ON submissions(mission_id);
CREATE INDEX IF NOT EXISTS idx_submissions_validation      ON submissions(validation_status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at      ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_flagged         ON submissions(is_flagged) WHERE is_flagged = 1;
