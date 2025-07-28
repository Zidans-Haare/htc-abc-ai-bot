const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelizeInstance = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../hochschuhl-abc.db'),
  logging: false
});

const Images = sequelizeInstance.define('Images', {
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
  tableName: 'images',
  timestamps: false
});

const createImagesTable = async () => {
  try {
    await Images.sync({ force: false });
    console.log('Tabelle "images" erfolgreich erstellt oder bereits vorhanden.');
  } catch (err) {
    console.error('Fehler beim Erstellen der images-Tabelle:', err.message);
  } finally {
    await sequelizeInstance.close();
  }
};

createImagesTable();
