const express = require('express');
const router = express.Router();
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
          data: {
            headline: newHeadline,
            text: `**${question}**\n${answer}`,
            editor: req.user.username,
            lastUpdated: new Date(),
            active: true,
            archived: null
          }
        });
      } else {
        entry = await HochschuhlABC.findUnique({ where: { id: parseInt(headlineId) } });
        if (!entry) {
          return res.status(404).json({ error: 'Headline not found' });
        }
        await HochschuhlABC.update({
          where: { id: parseInt(headlineId) },
          data: {
            text: entry.text + `\n\n**${question}**\n${answer}`,
            editor: req.user.username,
            lastUpdated: new Date()
          }
        });
        entry.id = headlineId; // for return
      }

      await Questions.updateMany({
        where: { question },
        data: { archived: true }
      });

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
        where.OR = [
          { headline: { contains: q } },
          { text: { contains: q } },
          { editor: { contains: q } }
        ];
      }
      const headlines = await HochschuhlABC.findMany({
        select: { id: true, headline: true, text: true },
        where,
        orderBy: { lastUpdated: 'desc' }
      });
      res.json(headlines);
    } catch (err) {
      console.error('Failed to load headlines:', err);
      res.status(500).json({ error: 'Failed to load headlines' });
    }
  });

  router.get('/entries/:id', adminAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    try {
      const entry = await HochschuhlABC.findUnique({ where: { id } });
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
        data: {
          headline,
          text,
          editor: req.user,
          lastUpdated: new Date(),
          active: active !== false,
          archived: null
        }
      });
      res.status(201).json(entry);
    } catch (err) {
      console.error('Failed to create entry:', err);
      res.status(500).json({ error: 'Failed to create entry' });
    }
  });

  router.put('/entries/:id', adminAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    const { headline, text, active } = req.body;
    if (!headline || !text) {
      return res.status(400).json({ error: 'Headline and text are required' });
    }
    try {
      const oldEntry = await HochschuhlABC.findUnique({ where: { id } });
      if (!oldEntry) return res.status(404).json({ error: 'Entry not found' });
      await HochschuhlABC.update({
        where: { id },
        data: { active: false, archived: new Date() }
      });
      const newEntry = await HochschuhlABC.create({
        data: {
          headline,
          text,
          editor: req.user,
          lastUpdated: new Date(),
          active: active !== false,
          archived: null
        }
      });
      res.json(newEntry);
    } catch (err) {
      console.error('Failed to update entry:', err);
      res.status(500).json({ error: 'Failed to update entry' });
    }
  });

  router.delete('/entries/:id', adminAuth, async (req, res) => {
    try {
      const entry = await HochschuhlABC.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!entry) return res.status(404).json({ error: 'Entry not found' });
      await HochschuhlABC.update({
        where: { id: parseInt(req.params.id) },
        data: { active: false, archived: new Date() }
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to delete entry:', err);
      res.status(500).json({ error: 'Failed to delete entry' });
    }
  });

  return router;
};
