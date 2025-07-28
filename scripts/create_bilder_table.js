const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelizeInstance = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../hochschuhl-abc.db'),
  logging: false
});

const Bilder = sequelizeInstance.define('Bilder', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'bilder',
  timestamps: false
});

const createBilderTable = async () => {
  try {
    await Bilder.sync({ force: false });
    console.log('Tabelle "bilder" erfolgreich erstellt oder bereits vorhanden.');
  } catch (err) {
    console.error('Fehler beim Erstellen der bilder-Tabelle:', err.message);
  } finally {
    await sequelizeInstance.close();
  }
};

createBilderTable();
