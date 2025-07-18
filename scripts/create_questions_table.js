const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../hochschuhl-abc.db'),
  logging: console.log
});

const Questions = sequelize.define('Questions', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  answer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  user: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  linked_article_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'hochschuhl_abc',
      key: 'id'
    }
  }
}, {
  tableName: 'questions',
  timestamps: false
});

async function createTable() {
  try {
    await Questions.sync({ force: false });
    console.log('Table `questions` created successfully.');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    await sequelize.close();
  }
}

createTable();
