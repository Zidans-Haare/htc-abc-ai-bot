const express = require('express');
const router = express.Router();
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('./db.cjs');
const fs = require('fs').promises;
const path = require('path');

// Define HochschuhlABC model
const HochschuhlABC = sequelize.define('HochschuhlABC', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  headline: {
    type: DataTypes.STRING,
    allowNull: false
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  editor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  archived: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'hochschuhl_abc',
  timestamps: false
});

// Sync database
sequelize.sync({ alter: true })
  .catch(err => console.error('SQLite sync error:', err.message));

// Admin auth middleware factory
const adminAuth = (getSession, logAction) => (req, res, next) => {
  const token = req.cookies.sessionToken;
  const session = token && getSession(token);
  if (session) {
    req.user = session.username;
    req.role = session.role;
    logAction(session.username, `${req.method} ${req.originalUrl}`);
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

// Factory function to create router with dependencies
module.exports = (getSession, logAction) => {
  router.get('/unanswered', adminAuth(getSession, logAction), async (req, res) => {
    try {
      const file = path.resolve(__dirname, '../ai_fragen/offene_fragen.txt');
      const data = await fs.readFile(file, 'utf8');
      const questions = data
        .split(/\n+/)
        .filter(Boolean)
        .map(line => {
          const match = line.match(/Frage:\s*(.*)$/);
          return match ? match[1].trim() : null;
        })
        .filter(Boolean);
      res.json(questions);
    } catch (err) {
      console.error('Failed to read unanswered questions:', err);
      res.status(500).json({ error: 'Failed to read unanswered questions' });
    }
  });

  router.post('/answer', adminAuth(getSession, logAction), async (req, res) => {
    const { question, answer, editor } = req.body || {};
    if (!question || !answer) {
      return res.status(400).json({ error: 'question and answer required' });
    }
    try {
      const faqFile = path.resolve(__dirname, '../ai_input/faq.txt');
      const unansweredFile = path.resolve(__dirname, '../ai_fragen/offene_fragen.txt');
      await fs.appendFile(
        faqFile,
        `F:${question}\nA:${answer}\nE:${editor || ''}\n`,
        'utf8'
      );
      const content = await fs.readFile(unansweredFile, 'utf8');
      const updated = content
        .split(/\n+/)
        .filter(line => !line.includes(`Frage: ${question}`))
        .join('\n');
      await fs.writeFile(unansweredFile, updated + (updated.endsWith('\n') ? '' : '\n'), 'utf8');
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to store answer:', err);
      res.status(500).json({ error: 'Failed to store answer' });
    }
  });

  router.get('/answered', adminAuth(getSession, logAction), async (req, res) => {
    try {
      const faqFile = path.resolve(__dirname, '../ai_input/faq.txt');
      const data = await fs.readFile(faqFile, 'utf8');
      const lines = data.split(/\n+/).filter(Boolean);
      const result = [];
      for (let i = 0; i < lines.length; i++) {
        const qMatch = lines[i].match(/^F:(.*)/);
        const aMatch = lines[i + 1] && lines[i + 1].match(/^A:(.*)/);
        if (qMatch && aMatch) {
          const eMatch = lines[i + 2] && lines[i + 2].match(/^E:(.*)/);
          result.push({
            question: qMatch[1].trim(),
            answer: aMatch[1].trim(),
            editor: eMatch ? eMatch[1].trim() : ''
          });
          i += eMatch ? 2 : 1;
        }
      }
      res.json(result);
    } catch (err) {
      console.error('Failed to read answered questions:', err);
      res.status(500).json({ error: 'Failed to read answered questions' });
    }
  });

  router.post('/update', adminAuth(getSession, logAction), async (req, res) => {
    const { question, answer, editor } = req.body || {};
    if (!question || !answer) {
      return res.status(400).json({ error: 'question and answer required' });
    }
    try {
      const faqFile = path.resolve(__dirname, '../ai_input/faq.txt');
      const lines = (await fs.readFile(faqFile, 'utf8')).split(/\n/);
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('F:') && lines[i].slice(2).trim() === question) {
          if (i + 1 < lines.length && lines[i + 1].startsWith('A:')) {
            lines[i + 1] = `A:${answer}`;
            if (i + 2 < lines.length && lines[i + 2].startsWith('E:')) {
              lines[i + 2] = `E:${editor || ''}`;
            } else {
              lines.splice(i + 2, 0, `E:${editor || ''}`);
            }
            found = true;
            break;
          }
        }
      }
      if (!found) {
        return res.status(404).json({ error: 'Question not found' });
      }
      await fs.writeFile(faqFile, lines.join('\n'), 'utf8');
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to update answer:', err);
      res.status(500).json({ error: 'Failed to update answer' });
    }
  });

  router.post('/move', adminAuth(getSession, logAction), async (req, res) => {
    const { question, answer, editor, headlineId, newHeadline } = req.body || {};
    if (!question || !answer || (!headlineId && !newHeadline)) {
      return res.status(400).json({ error: 'missing data' });
    }
    try {
      const faqFile = path.resolve(__dirname, '../ai_input/faq.txt');
      let lines = (await fs.readFile(faqFile, 'utf8')).split(/\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('F:') && lines[i].slice(2).trim() === question) {
          lines.splice(i, 1);
          if (i < lines.length && lines[i].startsWith('A:')) lines.splice(i, 1);
          if (i < lines.length && lines[i].startsWith('E:')) lines.splice(i, 1);
          break;
        }
      }
      await fs.writeFile(faqFile, lines.join('\n'), 'utf8');

      let entry;
      if (newHeadline) {
        entry = await HochschuhlABC.create({
          headline: newHeadline,
          text: answer,
          editor,
          lastUpdated: new Date(),
          active: true,
          archived: null
        });
      } else {
        const existing = await HochschuhlABC.findByPk(headlineId);
        if (!existing) return res.status(404).json({ error: 'Entry not found' });
        existing.active = false;
        existing.archived = new Date();
        await existing.save();
        entry = await HochschuhlABC.create({
          headline: existing.headline,
          text: (existing.text || '') + '\n' + answer,
          editor: editor || existing.editor,
          lastUpdated: new Date(),
          active: true,
          archived: null
        });
      }
      res.json({ success: true, id: entry.id });
    } catch (err) {
      console.error('Failed to move answer:', err);
      res.status(500).json({ error: 'Failed to move answer' });
    }
  });

  router.get('/headlines', adminAuth(getSession, logAction), async (req, res) => {
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

  router.get('/entries/:id', adminAuth(getSession, logAction), async (req, res) => {
    try {
      const entry = await HochschuhlABC.findByPk(req.params.id);
      if (!entry) return res.status(404).json({ error: 'Entry not found' });
      res.json(entry);
    } catch (err) {
      console.error('Failed to load entry:', err);
      res.status(500).json({ error: 'Failed to load entry' });
    }
  });

  router.post('/entries', adminAuth(getSession, logAction), async (req, res) => {
    const { headline, text, active, editor } = req.body;
    if (!headline || !text) {
      return res.status(400).json({ error: 'Headline and text are required' });
    }
    try {
      const entry = await HochschuhlABC.create({
        headline,
        text,
        editor,
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

  router.put('/entries/:id', adminAuth(getSession, logAction), async (req, res) => {
    const { headline, text, active, editor } = req.body;
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
        editor,
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

  router.delete('/entries/:id', adminAuth(getSession, logAction), async (req, res) => {
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

  router.get('/archive', adminAuth(getSession, logAction), async (req, res) => {
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

  router.post('/restore/:id', adminAuth(getSession, logAction), async (req, res) => {
    try {
      const archived = await HochschuhlABC.findByPk(req.params.id);
      if (!archived || archived.active) {
        return res.status(404).json({ error: 'Archived entry not found' });
      }
      const { editor } = req.body || {};
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
        editor: editor || archived.editor,
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

  router.get('/users', adminAuth(getSession, logAction), async (req, res) => {
    if (req.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const auth = require('./authController.cjs');
    const users = await auth.listUsers();
    res.json(users);
  });

  router.post('/users', adminAuth(getSession, logAction), async (req, res) => {
    if (req.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const { username, password, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'missing' });
    try {
      const auth = require('./authController.cjs');
      const user = await auth.createUser(username, password, role || 'editor');
      res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
      console.error('Failed to create user', err);
      res.status(500).json({ error: 'failed' });
    }
  });

  router.get('/export', adminAuth(getSession, logAction), async (req, res) => {
    try {
      const entries = await HochschuhlABC.findAll();
      const unansweredFile = path.resolve(__dirname, '../ai_fragen/offene_fragen.txt');
      const unanswered = (await fs.readFile(unansweredFile, 'utf8')).split(/\n+/).filter(Boolean);
      const faqFile = path.resolve(__dirname, '../ai_input/faq.txt');
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

  router.get('/stats', adminAuth(getSession, logAction), async (req, res) => {
    try {
      const entries = await HochschuhlABC.findAll();
      const perEditor = {};
      entries.forEach(e => {
        const name = e.editor || 'unknown';
        perEditor[name] = (perEditor[name] || 0) + 1;
      });
      res.json({ total: entries.length, perEditor });
    } catch (err) {
      console.error('Stats failed', err);
      res.status(500).json({ error: 'stats failed' });
    }
  });

  return router;
};

module.exports.HochschuhlABC = HochschuhlABC;