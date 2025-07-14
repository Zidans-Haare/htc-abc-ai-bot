const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { HochschuhlABC } = require('../db.cjs');

module.exports = (adminAuth) => {
  router.get('/export', adminAuth, async (req, res) => {
    try {
      const entries = await HochschuhlABC.findAll();
      const unansweredFile = path.resolve(__dirname, '../../ai_fragen/offene_fragen.txt');
      const unanswered = (await fs.readFile(unansweredFile, 'utf8')).split(/\n+/).filter(Boolean);
      const faqFile = path.resolve(__dirname, '../../ai_input/faq.txt');
      const data = await fs.readFile(faqFile, 'utf8');
      const lines = data.split(/\n+/).filter(Boolean);
      const answered = [];
      for (let i = 0; i < lines.length; i++) {
        const q = lines[i].match(/^F:(.*)/);
        const a = lines[i + 1] && lines[i + 1].match(/^A:(.*)/);
        if (q && a) {
          answered.push({ question: q[1].trim(), answer: a[1].trim() });
          i++;
        }
      }
      res.json({ entries, unanswered, answered });
    } catch (err) {
      console.error('Export failed', err);
      res.status(500).json({ error: 'export failed' });
    }
  });

  return router;
};
