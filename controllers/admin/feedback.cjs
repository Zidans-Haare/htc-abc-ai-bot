const express = require('express');
const { Feedback } = require('../db.cjs');

module.exports = (authMiddleware) => {
  const router = express.Router();

  router.get('/feedback', authMiddleware, async (req, res) => {
    try {
      const feedback = await Feedback.findAll({
        order: [['timestamp', 'DESC']],
      });
      res.json(feedback);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });

  return router;
};
