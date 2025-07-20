const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const { HochschuhlABC, Questions } = require('../db.cjs');

module.exports = (adminAuth) => {
  router.post('/move', adminAuth, async (req, res) => {
    const { question, answer, headlineId, newHeadline } = req.body;
    if (!question || !answer || (!headlineId && !newHeadline)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      let entry;
      if (newHeadline) {
        entry = await HochschuhlABC.create({
          headline: newHeadline,
          text: `**${question}**\n${answer}`,
          editor: req.user.username,
          lastUpdated: new Date(),
          active: true,
          archived: null
        });
      } else {
        entry = await HochschuhlABC.findByPk(headlineId);
        if (!entry) {
          return res.status(404).json({ error: 'Headline not found' });
        }
        entry.text += `\n\n**${question}**\n${answer}`;
        entry.editor = req.user.username;
        entry.lastUpdated = new Date();
        await entry.save();
      }

      await Questions.update(
        { archived: true },
        { where: { question: question } }
      );

      res.json({ success: true, entryId: entry.id });
    } catch (err) {
      console.error('Failed to move question:', err);
      res.status(500).json({ error: 'Failed to move question' });
    }
  });

  router.get('/headlines', adminAuth, async (req, res) => {
    try {
      const where = { active: true };
      const { q } = req.query;
      if (q) {
        where[Sequelize.Op.or] = [
          { headline: { [Sequelize.Op.like]: `%${q}%` } },
          { text: { [Sequelize.Op.like]: `%${q}%` } },
          { editor: { [Sequelize.Op.like]: `%${q}%` } }
        ];
      }
      const headlines = await HochschuhlABC.findAll({
        attributes: ['id', 'headline', 'text'],
        where,
        order: [['lastUpdated', 'DESC']]
      });
      res.json(headlines);
    } catch (err) {
      console.error('Failed to load headlines:', err);
      res.status(500).json({ error: 'Failed to load headlines' });
    }
  });

  router.get('/entries/:id', adminAuth, async (req, res) => {
    try {
      const entry = await HochschuhlABC.findByPk(req.params.id);
      if (!entry) return res.status(404).json({ error: 'Entry not found' });
      res.json(entry);
    } catch (err) {
      console.error('Failed to load entry:', err);
      res.status(500).json({ error: 'Failed to load entry' });
    }
  });

  router.post('/entries', adminAuth, async (req, res) => {
    const { headline, text, active } = req.body;
    if (!headline || !text) {
      return res.status(400).json({ error: 'Headline and text are required' });
    }
    try {
      const entry = await HochschuhlABC.create({
        headline,
        text,
        editor: req.user,
        lastUpdated: new Date(),
        active: active !== false,
        archived: null
      });
      res.status(201).json(entry);
    } catch (err) {
      console.error('Failed to create entry:', err);
      res.status(500).json({ error: 'Failed to create entry' });
    }
  });

  router.put('/entries/:id', adminAuth, async (req, res) => {
    const { headline, text, active } = req.body;
    if (!headline || !text) {
      return res.status(400).json({ error: 'Headline and text are required' });
    }
    try {
      const oldEntry = await HochschuhlABC.findByPk(req.params.id);
      if (!oldEntry) return res.status(404).json({ error: 'Entry not found' });
      oldEntry.active = false;
      oldEntry.archived = new Date();
      await oldEntry.save();
      const newEntry = await HochschuhlABC.create({
        headline,
        text,
        editor: req.user,
        lastUpdated: new Date(),
        active: active !== false,
        archived: null
      });
      res.json(newEntry);
    } catch (err) {
      console.error('Failed to update entry:', err);
      res.status(500).json({ error: 'Failed to update entry' });
    }
  });

  router.delete('/entries/:id', adminAuth, async (req, res) => {
    try {
      const entry = await HochschuhlABC.findByPk(req.params.id);
      if (!entry) return res.status(404).json({ error: 'Entry not found' });
      entry.active = false;
      entry.archived = new Date();
      await entry.save();
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to delete entry:', err);
      res.status(500).json({ error: 'Failed to delete entry' });
    }
  });

  return router;
};
