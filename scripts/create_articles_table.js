const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Database connection
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../hochschuhl-abc.db'),
  logging: false // Set to console.log to see SQL queries
});

// Define the Articles model
const Articles = sequelize.define('Articles', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  headline: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  editor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'draft' // e.g., draft, published, archived, crawled
  }
}, {
  tableName: 'articles',
  timestamps: false // We have our own lastUpdated field
});

// Function to create the table
async function createTable() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    
    await Articles.sync({ force: false }); // force: false will not drop the table if it already exists
    console.log('Table `articles` has been created or already exists.');

  } catch (error) {
    console.error('Unable to connect to the database or create table:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the function
createTable();
