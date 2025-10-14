const express = require('express');
const { Feedback } = require('../db.cjs');

module.exports = (authMiddleware) => {
  const router = express.Router();

  router.get('/feedback', authMiddleware, async (req, res) => {
    try {
      const feedback = await Feedback.findMany({
        orderBy: { timestamp: 'desc' },
      });
      res.json(feedback);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });

  router.get('/feedback/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const feedbackItem = await Feedback.findByPk(id);

      if (!feedbackItem) {
        return res.status(404).json({ msg: 'Feedback not found' });
      }

      res.json(feedbackItem);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });

  router.delete('/feedback/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const feedbackItem = await Feedback.findByPk(id);

      if (!feedbackItem) {
        return res.status(404).json({ msg: 'Feedback not found' });
      }

      await feedbackItem.destroy();
      res.status(204).send();
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });

  return router;
};
