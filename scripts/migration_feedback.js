const { sequelize, Feedback } = require('./controllers/db.cjs');

async function migrate() {
  try {
    const queryInterface = sequelize.getQueryInterface();

    // Add the new column
    await queryInterface.addColumn('feedback', 'attached_chat_history', {
      type: sequelize.Sequelize.TEXT,
      allowNull: true,
    });

    console.log('Migration successful: attached_chat_history column added.');
  } catch (error) {
    if (error.message.includes('duplicate column name')) {
      console.log('Migration not needed: attached_chat_history column already exists.');
    } else {
      console.error('Migration failed:', error);
    }
  } finally {
    await sequelize.close();
  }
}

migrate();