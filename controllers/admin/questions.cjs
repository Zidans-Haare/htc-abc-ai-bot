const express = require('express');
const router = express.Router();
const { Questions } = require('../db.cjs');
const { Op } = require('sequelize');

module.exports = (adminAuth) => {
  router.get('/unanswered', adminAuth, async (req, res) => {
    try {
      const questions = await Questions.findAll({
        where: {
          answered: false,
          archived: false,
          deleted: false,
          spam: false
        },
        order: [['lastUpdated', 'DESC']]
      });
      res.json(questions.map(q => q.question));
    } catch (err) {
      console.error('Failed to read unanswered questions:', err);
      res.status(500).json({ error: 'Failed to read unanswered questions' });
    }
  });

  router.delete('/unanswered', adminAuth, async (req, res) => {
    const { questions } = req.body || {};
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions required' });
    }
    try {
      await Questions.update(
        { deleted: true },
        { where: { question: { [Op.in]: questions } } }
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to delete unanswered questions:', err);
      res.status(500).json({ error: 'Failed to delete unanswered questions' });
    }
  });

  router.post('/answer', adminAuth, async (req, res) => {
    const { question, answer } = req.body || {};
    if (!question || !answer) {
      return res.status(400).json({ error: 'question and answer required' });
    }
    try {
      await Questions.update(
        {
          answer: answer,
          answered: true,
          user: req.user.username
        },
        { where: { question: question } }
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to save answer:', err);
      res.status(500).json({ error: 'Failed to save answer' });
    }
  });

  return router;
};
