const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('./db.cjs');

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

// Get all active headlines (include text for searching)
exports.getHeadlines = async (req, res) => {
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
};

// Get a specific entry by ID
exports.getEntry = async (req, res) => {
  try {
    const entry = await HochschuhlABC.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    console.error('Failed to load entry:', err);
    res.status(500).json({ error: 'Failed to load entry' });
  }
};

// Create a new entry
exports.createEntry = async (req, res) => {
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
};

// Update an existing entry
exports.updateEntry = async (req, res) => {
  const { headline, text, active, editor } = req.body;
  if (!headline || !text) {
    return res.status(400).json({ error: 'Headline and text are required' });
  }

  try {
    const oldEntry = await HochschuhlABC.findByPk(req.params.id);
    if (!oldEntry) return res.status(404).json({ error: 'Entry not found' });

    // Mark old entry as archived
    oldEntry.active = false;
    oldEntry.archived = new Date();
    await oldEntry.save();

    // Create new entry
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
};

// Delete an entry
exports.deleteEntry = async (req, res) => {
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
};

// Get archived entries
exports.getArchive = async (req, res) => {
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
};

// Restore an archived entry by creating a new active version
exports.restoreEntry = async (req, res) => {
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
};

module.exports.HochschuhlABC = HochschuhlABC;
