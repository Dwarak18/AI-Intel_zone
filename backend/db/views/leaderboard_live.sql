-- =============================================================================
-- AI INTELLIGENCE ZONE — Control Arena
-- View: live_leaderboard
-- Returns: live score table displayed on the admin Live Scores page
-- Compatible: SQLite / PostgreSQL
-- =============================================================================

DROP VIEW IF EXISTS live_leaderboard;

CREATE VIEW live_leaderboard AS
SELECT
    t.current_rank                                              AS rank,
    t.team_code,
    t.name                                                      AS team_name,
    t.login_password,
    t.institution,
    t.status,
    t.avatar_color,

    -- ── Scores ───────────────────────────────────────────────────
    ROUND(t.total_score, 2)                                     AS total_score,
    ROUND(t.bonus_points, 2)                                    AS bonus_points,
    ROUND(t.total_score + t.bonus_points, 2)                    AS combined_score,

    -- ── Activity ─────────────────────────────────────────────────
    t.missions_completed,
    t.total_submissions,
    t.successful_validations,
    t.failed_validations,

    -- ── Rates ────────────────────────────────────────────────────
    CASE
        WHEN t.total_submissions > 0
        THEN ROUND(t.successful_validations * 100.0 / t.total_submissions, 1)
        ELSE 0.0
    END                                                         AS validation_rate,

    ROUND(t.health_score, 1)                                    AS health_score,
    t.hallucination_count,

    -- ── Timestamps ───────────────────────────────────────────────
    t.last_activity_at,
    t.created_at

FROM teams t
WHERE t.status != 'disqualified'
ORDER BY
    t.current_rank IS NULL,
    t.current_rank ASC,
    combined_score DESC;


-- =============================================================================
-- Useful query: latest submission per team (for "Last Active" column)
-- =============================================================================
-- SELECT
--     s.team_id,
--     MAX(s.created_at) AS last_submission_at,
--     COUNT(*)           AS total,
--     SUM(CASE WHEN s.validation_status = 'valid' THEN 1 ELSE 0 END) AS valid_count
-- FROM submissions s
-- GROUP BY s.team_id;
