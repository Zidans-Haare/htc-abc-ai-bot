const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../hochschuhl-abc.db'),
  logging: console.log
});

const queryInterface = sequelize.getQueryInterface();

async function addColumns() {
  try {
    await queryInterface.addColumn('Questions', 'answered', {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    });
    await queryInterface.addColumn('Questions', 'spam', {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    });
    await queryInterface.addColumn('Questions', 'deleted', {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    });
    console.log('Columns added successfully.');
  } catch (error) {
    console.error('Error adding columns:', error);
  } finally {
    await sequelize.close();
  }
}

addColumns();
