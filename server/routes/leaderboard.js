const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/leaderboard
router.get('/', (req, res) => {
  try {
    const leaderboard = db.getLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
