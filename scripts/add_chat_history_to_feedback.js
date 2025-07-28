const { sequelize, Feedback } = require('../controllers/db.cjs');
const { DataTypes } = require('sequelize');

async function addColumn() {
  const queryInterface = sequelize.getQueryInterface();
  try {
    await queryInterface.addColumn('feedback', 'attached_chat_history', {
      type: DataTypes.TEXT,
      allowNull: true,
    });
    console.log('Column "attached_chat_history" added to "feedback" table.');
  } catch (error) {
    if (error.message.includes('duplicate column name')) {
      console.log('Column "attached_chat_history" already exists in "feedback" table.');
    } else {
      console.error('Error adding column:', error);
    }
  } finally {
    await sequelize.close();
  }
}

addColumn();
