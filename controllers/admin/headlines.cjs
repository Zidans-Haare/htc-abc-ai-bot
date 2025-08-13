const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const { Articles, Questions } = require('../db.cjs'); // Changed from HochschuhlABC to Articles

module.exports = (adminAuth) => {
  // This route seems to be for moving a question to an article.
  // It needs to be updated to use the Articles model.
  router.post('/move', adminAuth, async (req, res) => {
    const { question, answer, headlineId, newHeadline } = req.body;
    if (!question || !answer || (!headlineId && !newHeadline)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      let entry;
      if (newHeadline) {
        entry = await Articles.create({ // Changed from HochschuhlABC
          headline: newHeadline,
          text: `**${question}**\n${answer}`,
          editor: req.user.username,
          lastUpdated: new Date(),
          status: 'published' // Assuming a new article from a question is published
        });
      } else {
        entry = await Articles.findByPk(headlineId); // Changed from HochschuhlABC
        if (!entry) {
          return res.status(404).json({ error: 'Headline not found' });
        }
        entry.text += `\n\n**${question}**\n${answer}`;
        entry.editor = req.user.username;
        entry.lastUpdated = new Date();
        await entry.save();
      }

      // This part seems to archive the question after it's moved.
      // It should be checked if this is the desired behavior.
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

  // This is the main route for fetching headlines.
  router.get('/headlines', adminAuth, async (req, res) => {
    try {
      const where = { 
        // We want to see all articles that are not crawled, or are published
        status: { [Sequelize.Op.ne]: 'crawled' }
      };
      const { q } = req.query;
      if (q) {
        where[Sequelize.Op.or] = [
          { headline: { [Sequelize.Op.like]: `%${q}%` } },
          { text: { [Sequelize.Op.like]: `%${q}%` } },
          { editor: { [Sequelize.Op.like]: `%${q}%` } }
        ];
      }
      const headlines = await Articles.findAll({ // Changed from HochschuhlABC
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

  // This route fetches a single entry.
  router.get('/entries/:id', adminAuth, async (req, res) => {
    try {
      const entry = await Articles.findByPk(req.params.id); // Changed from HochschuhlABC
      if (!entry) return res.status(404).json({ error: 'Entry not found' });
      res.json(entry);
    } catch (err) {
      console.error('Failed to load entry:', err);
      res.status(500).json({ error: 'Failed to load entry' });
    }
  });

  // This route creates a new entry.
  router.post('/entries', adminAuth, async (req, res) => {
    const { headline, text, status } = req.body;
    if (!headline || !text) {
      return res.status(400).json({ error: 'Headline and text are required' });
    }
    try {
      const entry = await Articles.create({ // Changed from HochschuhlABC
        headline,
        text,
        editor: req.user,
        lastUpdated: new Date(),
        status: status || 'draft'
      });
      res.status(201).json(entry);
    } catch (err) {
      console.error('Failed to create entry:', err);
      res.status(500).json({ error: 'Failed to create entry' });
    }
  });

  // This route updates an entry.
  // The old logic created a new entry and archived the old one.
  // This is not ideal. I will change it to a simple update.
  router.put('/entries/:id', adminAuth, async (req, res) => {
    const { headline, text, status } = req.body;
    if (!headline || !text) {
      return res.status(400).json({ error: 'Headline and text are required' });
    }
    try {
      const entry = await Articles.findByPk(req.params.id); // Changed from HochschuhlABC
      if (!entry) return res.status(404).json({ error: 'Entry not found' });
      
      entry.headline = headline;
      entry.text = text;
      entry.status = status || entry.status;
      entry.editor = req.user;
      entry.lastUpdated = new Date();
      
      await entry.save();
      res.json(entry);
    } catch (err) {
      console.error('Failed to update entry:', err);
      res.status(500).json({ error: 'Failed to update entry' });
    }
  });

  // This route deletes an entry by changing its status to 'archived'.
  router.delete('/entries/:id', adminAuth, async (req, res) => {
    try {
      const entry = await Articles.findByPk(req.params.id); // Changed from HochschuhlABC
      if (!entry) return res.status(404).json({ error: 'Entry not found' });
      entry.status = 'archived';
      await entry.save();
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to delete entry:', err);
      res.status(500).json({ error: 'Failed to delete entry' });
    }
  });

  return router;
};