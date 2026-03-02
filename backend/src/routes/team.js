// ==============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Team Routes — Session-based member portal
// ==============================================================================

const express = require('express');
const router = express.Router();
const { requireTeamLogin } = require('../authMiddleware');
const { requireRole } = require('../security');

const teamAuth = [requireTeamLogin];

router.get('/', ...teamAuth, (req, res) => {
  res.redirect('/team/console');
});

router.get('/console', ...teamAuth, (req, res) => {
  res.render('team/mission_console', {
    layout: false,
    title: 'Mission Console',
    user: req.user,
    flash: { success: req.flash('success'), error: req.flash('error'), warning: req.flash('warning') },
  });
});

router.get('/mission-console', ...teamAuth, (req, res) => {
  res.render('team/mission_console', {
    layout: false,
    title: 'Mission Console',
    user: req.user,
    flash: { success: req.flash('success'), error: req.flash('error'), warning: req.flash('warning') },
  });
});

module.exports = router;
