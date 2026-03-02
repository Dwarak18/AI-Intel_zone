// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Team Routes — Legacy session-based routes (kept for backward compat)
// React SPA now handles /team/* page routes via the SPA catch-all.
// ==============================================================================

const express = require('express');
const router = express.Router();

// All /team/* page routes are handled by the React SPA catch-all.
// This router is kept to avoid breaking any remaining session-based redirects.

module.exports = router;

