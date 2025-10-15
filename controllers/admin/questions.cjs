const express = require('express');
const router = express.Router();
const { Questions, HochschuhlABC } = require('../db.cjs');

module.exports = (adminAuth) => {
  router.get('/unanswered', adminAuth, async (req, res) => {
    try {
      const offset = parseInt(req.query.offset) || 0;
      const questions = await Questions.findMany({
        where: {
          answered: false,
          archived: false,
          deleted: false,
          spam: false
        },
        orderBy: { lastUpdated: 'desc' },
         take: 100,
        skip: offset
      });
      res.json(questions);
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
      await Questions.updateMany({
        where: { question: { in: questions } },
        data: { deleted: true }
      });
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
      await Questions.updateMany({
        where: { question },
        data: {
          answer,
          answered: true,
          user: req.user.username
        }
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to save answer:', err);
      res.status(500).json({ error: 'Failed to save answer' });
    }
  });

  router.get('/answered', adminAuth, async (req, res) => {
    try {
      const offset = parseInt(req.query.offset) || 0;
      const questions = await Questions.findMany({
        include: {
          hochschuhl_abc: {
            select: { headline: true, text: true }
          }
        },
        where: {
          answered: true,
          archived: false,
          deleted: false
        },
        orderBy: { lastUpdated: 'desc' },
         take: 100,
        skip: offset
      });
      res.json(questions);
    } catch (err) {
      console.error('Failed to read answered questions:', err);
      res.status(500).json({ error: 'Failed to read answered questions' });
    }
  });

  router.post('/mark-answered', adminAuth, async (req, res) => {
    const { questionId } = req.body || {};
    if (!questionId) {
      return res.status(400).json({ error: 'questionId required' });
    }
    try {
      const result = await Questions.updateMany({
        where: { id: parseInt(questionId) },
        data: {
          answered: true,
          user: req.user.username
        }
      });

      if (result.count === 0) {
        return res.status(404).json({ message: 'Question not found.' });
      }

      res.json({ success: true, message: 'Question marked as answered.' });
    } catch (err) {
      console.error('Failed to mark question as answered:', err);
      res.status(500).json({ error: 'Failed to mark question as answered' });
    }
  });

  router.post('/questions/link-article', adminAuth, async (req, res) => {
    const { questionId, articleId } = req.body;

    if (!questionId || !articleId) {
      return res.status(400).json({ error: 'questionId and articleId are required' });
    }

    try {
      await Questions.updateMany({
        where: { id: parseInt(questionId) },
        data: {
          linked_article_id: parseInt(articleId),
          user: req.user.username
        }
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to link article to question:', error);
      res.status(500).json({ error: 'Failed to link article to question' });
    }
  });

  return router;
};
