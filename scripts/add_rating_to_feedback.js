const { sequelize } = require('../controllers/db.cjs');

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  try {
    await queryInterface.addColumn('feedback', 'rating', { 
      type: sequelize.Sequelize.INTEGER,
      allowNull: true,
    });
    console.log('Migration successful: rating column added to feedback table.');
  } catch (error) {
    if (error.message.includes('duplicate column name')) {
      console.log('Migration not needed: rating column already exists in feedback table.');
    } else {
      console.error('Migration failed:', error);
    }
  } finally {
    await sequelize.close();
  }
}

migrate();