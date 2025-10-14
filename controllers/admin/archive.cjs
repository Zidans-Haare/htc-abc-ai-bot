const express = require('express');
const router = express.Router();
const { HochschuhlABC } = require('../db.cjs');

module.exports = (adminAuth) => {
  router.get('/archive', adminAuth, async (req, res) => {
    try {
      const archivedEntries = await HochschuhlABC.findMany({
        where: {
          active: false,
          archived: { not: null }
        },
        orderBy: { archived: 'desc' }
      });
      res.json(archivedEntries);
    } catch (err) {
      console.error('Failed to load archive:', err);
      res.status(500).json({ error: 'Failed to load archive' });
    }
  });

  router.post('/restore/:id', adminAuth, async (req, res) => {
    try {
      const archived = await HochschuhlABC.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!archived || archived.active) {
        return res.status(404).json({ error: 'Archived entry not found' });
      }
      const activeEntry = await HochschuhlABC.findFirst({
        where: { headline: archived.headline, active: true }
      });
      if (activeEntry) {
        await HochschuhlABC.update({
          where: { id: activeEntry.id },
          data: { active: false, archived: new Date() }
        });
      }
      const newEntry = await HochschuhlABC.create({
        data: {
          headline: archived.headline,
          text: archived.text,
          editor: req.user,
          lastUpdated: new Date(),
          active: true,
          archived: null
        }
      });
      res.json(newEntry);
    } catch (err) {
      console.error('Failed to restore entry:', err);
      res.status(500).json({ error: 'Failed to restore entry' });
    }
  });

  return router;
};
