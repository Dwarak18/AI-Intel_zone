-- ==============================================================================
-- AI INTELLIGENCE ZONE — Control Arena
-- Full PostgreSQL Schema
-- Generated for production deployment (35 teams / ~127 users)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- USERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username        VARCHAR(80)     NOT NULL UNIQUE,
    email           VARCHAR(120)    NOT NULL UNIQUE,
    password_hash   VARCHAR(256)    NOT NULL,
    role            VARCHAR(20)     NOT NULL DEFAULT 'team_member',
                                    -- 'super_admin' | 'admin' | 'moderator' | 'team_member' | 'team_lead'
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    last_login_ip   VARCHAR(45),
    login_count     INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username  ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users (role);

-- ==============================================================================
-- TEAMS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS teams (
    id                      VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
    team_code               VARCHAR(20)     NOT NULL UNIQUE,
    name                    VARCHAR(100)    NOT NULL,
    institution             VARCHAR(200),
    login_password          VARCHAR(255),
    status                  VARCHAR(20)     NOT NULL DEFAULT 'active',
                                            -- 'active' | 'locked' | 'disqualified' | 'pending'
    disqualification_reason TEXT,
    avatar_color            VARCHAR(7)      DEFAULT '#3B82F6',

    -- Scoring aggregates (denormalized for performance)
    total_score             FLOAT           NOT NULL DEFAULT 0.0,
    missions_completed      INTEGER         NOT NULL DEFAULT 0,
    total_submissions       INTEGER         NOT NULL DEFAULT 0,
    successful_validations  INTEGER         NOT NULL DEFAULT 0,
    failed_validations      INTEGER         NOT NULL DEFAULT 0,
    current_rank            INTEGER,
    bonus_points            FLOAT           NOT NULL DEFAULT 0.0,
    error_rate              FLOAT           NOT NULL DEFAULT 0.0,
    hallucination_count     INTEGER         NOT NULL DEFAULT 0,
    avg_response_time       FLOAT           NOT NULL DEFAULT 0.0,
    health_score            FLOAT           NOT NULL DEFAULT 100.0,
    last_activity_at        TIMESTAMPTZ,

    -- Soft delete support
    deleted_at              TIMESTAMPTZ,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_team_code      ON teams (team_code);
CREATE INDEX IF NOT EXISTS idx_teams_status         ON teams (status);
CREATE INDEX IF NOT EXISTS idx_teams_current_rank   ON teams (current_rank);
CREATE INDEX IF NOT EXISTS idx_teams_total_score    ON teams (total_score DESC);
CREATE INDEX IF NOT EXISTS idx_teams_last_activity  ON teams (last_activity_at);

-- ==============================================================================
-- TEAM MEMBERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS team_members (
    id                  VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
    team_id             VARCHAR(36)     NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id             VARCHAR(36)     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_team        VARCHAR(20)     NOT NULL DEFAULT 'member',
                                        -- 'lead' | 'member' | 'observer'
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    submissions_count   INTEGER         NOT NULL DEFAULT 0,
    participation_score FLOAT           NOT NULL DEFAULT 0.0,
    joined_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_active_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id  ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id  ON team_members (user_id);

-- ==============================================================================
-- MISSIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS missions (
    id                  VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mission_code        VARCHAR(20)     NOT NULL UNIQUE,
    title               VARCHAR(200)    NOT NULL,
    description         TEXT            NOT NULL,
    objective           TEXT,
    difficulty          VARCHAR(20)     NOT NULL DEFAULT 'medium',
                                        -- 'easy' | 'medium' | 'hard' | 'expert'
    category            VARCHAR(50),
    input_text          TEXT,
    output_format_hint  TEXT,
    valid_example       TEXT,
    invalid_example     TEXT,
    expected_schema     TEXT,           -- JSON string
    expected_fields     TEXT,           -- JSON array string
    validation_regex    TEXT,           -- JSON object string
    enum_constraints    TEXT,           -- JSON object string
    sample_response     TEXT,
    max_points          FLOAT           NOT NULL DEFAULT 100.0,
    time_limit_seconds  INTEGER         NOT NULL DEFAULT 600,
    max_retries         INTEGER         NOT NULL DEFAULT 20,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    is_visible          BOOLEAN         NOT NULL DEFAULT FALSE,
    order_index         INTEGER         NOT NULL DEFAULT 0,
    unlock_after_mission VARCHAR(36),
    first_blood_team_id VARCHAR(36),
    first_blood_at      TIMESTAMPTZ,
    total_attempts      INTEGER         NOT NULL DEFAULT 0,
    total_completions   INTEGER         NOT NULL DEFAULT 0,
    avg_completion_time FLOAT           NOT NULL DEFAULT 0.0,
    starts_at           TIMESTAMPTZ,
    ends_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_is_active  ON missions (is_active);
CREATE INDEX IF NOT EXISTS idx_missions_order      ON missions (order_index);

-- ==============================================================================
-- SUBMISSIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS submissions (
    id                  VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
    team_id             VARCHAR(36)     NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    mission_id          VARCHAR(36)     NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    submitted_by        VARCHAR(36)     REFERENCES users(id) ON DELETE SET NULL,
    attempt_number      INTEGER         NOT NULL DEFAULT 1,
    prompt_text         TEXT            NOT NULL,
    ai_raw_response     TEXT,
    parsed_response     TEXT,
    validation_status   VARCHAR(20)     NOT NULL DEFAULT 'pending',
                                        -- 'valid' | 'invalid' | 'error' | 'pending'
    json_valid          BOOLEAN,
    schema_valid        BOOLEAN,
    type_check_valid    BOOLEAN,
    regex_valid         BOOLEAN,
    field_count_valid   BOOLEAN,
    validation_errors   TEXT,           -- JSON array string
    accuracy_score      FLOAT           NOT NULL DEFAULT 0.0,
    speed_score         FLOAT           NOT NULL DEFAULT 0.0,
    validation_score    FLOAT           NOT NULL DEFAULT 0.0,
    confidence_score    FLOAT           NOT NULL DEFAULT 0.0,
    total_score         FLOAT           NOT NULL DEFAULT 0.0,
    bonus_awarded       FLOAT           NOT NULL DEFAULT 0.0,
    bonus_type          VARCHAR(50),
    response_time_ms    INTEGER,
    prompt_length       INTEGER,
    response_length     INTEGER,
    ip_address          VARCHAR(45),
    user_agent          VARCHAR(500),
    is_flagged          BOOLEAN         NOT NULL DEFAULT FALSE,
    flag_reason         VARCHAR(200),
    injection_detected  BOOLEAN         NOT NULL DEFAULT FALSE,
    is_hallucinated     BOOLEAN         NOT NULL DEFAULT FALSE,
    validated_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_team_id          ON submissions (team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_mission_id       ON submissions (mission_id);
CREATE INDEX IF NOT EXISTS idx_submissions_team_mission     ON submissions (team_id, mission_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at       ON submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_validation_status ON submissions (validation_status);
CREATE INDEX IF NOT EXISTS idx_submissions_is_flagged       ON submissions (is_flagged);

-- Prevent duplicate counting: only one 'valid' submission per team+mission should award points
-- (enforced at application layer via attemptNumber logic, not with a unique constraint
--  because teams can correct after failure)

-- ==============================================================================
-- AI LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS ai_logs (
    id                      VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    team_id                 VARCHAR(36) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    submission_id           VARCHAR(36) REFERENCES submissions(id) ON DELETE SET NULL,
    user_id                 VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    prompt_text             TEXT        NOT NULL,
    system_prompt_used      TEXT,
    ai_model_used           VARCHAR(50),
    ai_raw_output           TEXT,
    ai_parsed_output        TEXT,
    parse_result            VARCHAR(20),    -- 'success' | 'failed' | 'partial'
    validation_result       VARCHAR(20),    -- 'pass' | 'fail' | 'skip'
    error_details           TEXT,
    rejected                BOOLEAN     NOT NULL DEFAULT FALSE,
    rejection_reason        VARCHAR(500),
    retry_attempt           INTEGER     NOT NULL DEFAULT 0,
    token_count_prompt      INTEGER,
    token_count_response    INTEGER,
    response_latency_ms     INTEGER,
    confidence_score        FLOAT,
    hallucination_probability FLOAT     NOT NULL DEFAULT 0.0,
    injection_score         FLOAT       NOT NULL DEFAULT 0.0,
    suspicious_patterns     TEXT,
    ip_address              VARCHAR(45),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_team_id      ON ai_logs (team_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at   ON ai_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_flagged      ON ai_logs (injection_score) WHERE injection_score > 0.5;

-- ==============================================================================
-- AUDIT LOGS (immutable — no UPDATE, no DELETE allowed via application)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id                  VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id             VARCHAR(36),    -- actor (nullable for system actions)
    team_id             VARCHAR(36),    -- affected team (nullable)
    action              VARCHAR(100)    NOT NULL,
    resource_type       VARCHAR(50),
    resource_id         VARCHAR(36),
    description         TEXT,
    ip_address          VARCHAR(45),
    user_agent          VARCHAR(500),
    request_method      VARCHAR(10),
    request_path        VARCHAR(500),
    request_payload_hash VARCHAR(64),
    response_status     INTEGER,
    severity            VARCHAR(20)     NOT NULL DEFAULT 'info',
                                        -- 'info' | 'warning' | 'error' | 'critical'
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
    -- No updated_at — audit logs are immutable
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_team_id     ON audit_logs (team_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity    ON audit_logs (severity);

-- ==============================================================================
-- SECURITY EVENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS security_events (
    id                  VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
    team_id             VARCHAR(36)     REFERENCES teams(id) ON DELETE SET NULL,
    user_id             VARCHAR(36)     REFERENCES users(id) ON DELETE SET NULL,
    submission_id       VARCHAR(36)     REFERENCES submissions(id) ON DELETE SET NULL,
    event_type          VARCHAR(50)     NOT NULL,
                                        -- 'injection_attempt' | 'rate_limit_violation' |
                                        -- 'auth_failure' | 'suspicious_retry' | 'invalid_json'
    severity            VARCHAR(20)     NOT NULL DEFAULT 'medium',
                                        -- 'low' | 'medium' | 'high' | 'critical'
    description         TEXT            NOT NULL,
    evidence            TEXT,           -- JSON object with supporting data
    ip_address          VARCHAR(45),
    user_agent          VARCHAR(500),
    status              VARCHAR(20)     NOT NULL DEFAULT 'open',
                                        -- 'open' | 'acknowledged' | 'resolved' | 'false_positive'
    resolved_by         VARCHAR(36),
    resolved_at         TIMESTAMPTZ,
    resolution_notes    TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_team_id    ON security_events (team_id);
CREATE INDEX IF NOT EXISTS idx_security_events_severity   ON security_events (severity);
CREATE INDEX IF NOT EXISTS idx_security_events_status     ON security_events (status);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events (created_at DESC);

-- ==============================================================================
-- ACHIEVEMENTS (bonus points)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS achievements (
    id              VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
    team_id         VARCHAR(36)     NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    mission_id      VARCHAR(36)     REFERENCES missions(id) ON DELETE SET NULL,
    achievement_type VARCHAR(50)    NOT NULL,
                                    -- 'first_blood' | 'speed_demon' | 'perfect_parse' |
                                    -- 'consistency' | 'efficient_prompt'
    title           VARCHAR(100)    NOT NULL,
    description     VARCHAR(500),
    icon            VARCHAR(10),
    points_awarded  FLOAT           NOT NULL DEFAULT 0.0,
    awarded_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_team_id ON achievements (team_id);

-- ==============================================================================
-- SCORE OVERRIDES (admin manual adjustments)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS score_overrides (
    id              VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
    team_id         VARCHAR(36)     NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    admin_id        VARCHAR(36)     NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    mission_id      VARCHAR(36)     REFERENCES missions(id) ON DELETE SET NULL,
    previous_score  FLOAT           NOT NULL,
    new_score       FLOAT           NOT NULL,
    reason          TEXT            NOT NULL,
    override_type   VARCHAR(20)     NOT NULL,
                                    -- 'correction' | 'penalty' | 'bonus' | 'reset'
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- LEADERBOARD CACHE (point-in-time snapshots)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS leaderboard_cache (
    id                  VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
    team_id             VARCHAR(36)     NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    rank                INTEGER         NOT NULL,
    total_score         FLOAT           NOT NULL DEFAULT 0.0,
    bonus_points        FLOAT           NOT NULL DEFAULT 0.0,
    missions_completed  INTEGER         NOT NULL DEFAULT 0,
    total_submissions   INTEGER         NOT NULL DEFAULT 0,
    validation_rate     FLOAT           NOT NULL DEFAULT 0.0,
    health_score        FLOAT           NOT NULL DEFAULT 0.0,
    first_valid_at      TIMESTAMPTZ,
    snapshot_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_team_id    ON leaderboard_cache (team_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_snapshot   ON leaderboard_cache (snapshot_at DESC);

-- ==============================================================================
-- LEADERBOARD VIEW (live rankings query)
-- ==============================================================================
CREATE OR REPLACE VIEW leaderboard_live AS
SELECT
    t.id,
    t.team_code,
    t.name,
    t.institution,
    t.status,
    t.total_score,
    t.bonus_points,
    ROUND((t.total_score + t.bonus_points)::numeric, 2) AS combined_score,
    t.missions_completed,
    t.total_submissions,
    t.successful_validations,
    CASE
        WHEN t.total_submissions > 0
        THEN ROUND((t.successful_validations::float / t.total_submissions * 100)::numeric, 1)
        ELSE 0
    END AS validation_rate_pct,
    t.health_score,
    t.current_rank,
    t.last_activity_at,
    ROW_NUMBER() OVER (
        ORDER BY
            (t.total_score + t.bonus_points) DESC,
            t.missions_completed DESC,
            t.last_activity_at ASC NULLS LAST  -- tie-break: earlier last activity = faster
    ) AS live_rank
FROM teams t
WHERE t.status IN ('active', 'locked')
  AND t.deleted_at IS NULL;

-- ==============================================================================
-- TRIGGER: updated_at auto-update
-- ==============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users', 'teams', 'team_members', 'missions', 'submissions',
        'ai_logs', 'security_events', 'score_overrides'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %s
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            t, t
        );
    END LOOP;
END;
$$;
