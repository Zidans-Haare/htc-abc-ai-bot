const express = require('express');
const router = express.Router();
const { HochschuhlABC } = require('../db.cjs');

module.exports = (adminAuth) => {
  router.get('/stats', adminAuth, async (req, res) => {
    try {
      const entries = await HochschuhlABC.findAll();
      const perEditor = {};
      entries.forEach(e => {
        const name = e.editor || 'unknown';
        perEditor[name] = (perEditor[name] || 0) + 1;
      });
      res.json({ total: entries.length, perEditor });
    } catch (err) {
      console.error('Stats failed', err);
      res.status(500).json({ error: 'stats failed' });
    }
  });

  return router;
};
