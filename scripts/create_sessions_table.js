const { sequelize } = require('../controllers/db.cjs');

async function createSessionsTable() {
  const queryInterface = sequelize.getQueryInterface();
  try {
    await queryInterface.createTable('sessions', {
      token: {
        type: sequelize.Sequelize.STRING,
        primaryKey: true
      },
      username: {
        type: sequelize.Sequelize.STRING,
        allowNull: false
      },
      role: {
        type: sequelize.Sequelize.STRING,
        allowNull: false
      },
      expires: {
        type: sequelize.Sequelize.DATE,
        allowNull: false
      }
    });
    console.log('Migration successful: sessions table created.');
  } catch (error) {
    if (error.message.includes('table sessions already exists')) {
      console.log('Migration not needed: sessions table already exists.');
    } else {
      console.error('Migration failed:', error);
    }
  } finally {
    await sequelize.close();
  }
}

createSessionsTable();