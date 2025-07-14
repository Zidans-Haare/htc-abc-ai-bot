const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const { HochschuhlABC } = require('../db.cjs');

module.exports = (adminAuth) => {
  router.get('/archive', adminAuth, async (req, res) => {
    try {
      const archivedEntries = await HochschuhlABC.findAll({
        where: {
          active: false,
          archived: { [Sequelize.Op.not]: null }
        },
        order: [['archived', 'DESC']]
      });
      res.json(archivedEntries);
    } catch (err) {
      console.error('Failed to load archive:', err);
      res.status(500).json({ error: 'Failed to load archive' });
    }
  });

  router.post('/restore/:id', adminAuth, async (req, res) => {
    try {
      const archived = await HochschuhlABC.findByPk(req.params.id);
      if (!archived || archived.active) {
        return res.status(404).json({ error: 'Archived entry not found' });
      }
      const activeEntry = await HochschuhlABC.findOne({
        where: { headline: archived.headline, active: true }
      });
      if (activeEntry) {
        activeEntry.active = false;
        activeEntry.archived = new Date();
        await activeEntry.save();
      }
      const newEntry = await HochschuhlABC.create({
        headline: archived.headline,
        text: archived.text,
        editor: req.user,
        lastUpdated: new Date(),
        active: true,
        archived: null
      });
      res.json(newEntry);
    } catch (err) {
      console.error('Failed to restore entry:', err);
      res.status(500).json({ error: 'Failed to restore entry' });
    }
  });

  return router;
};
