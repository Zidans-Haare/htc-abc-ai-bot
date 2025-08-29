const { sequelize } = require('../controllers/db.cjs');

async function repairDatabase() {
  const queryInterface = sequelize.getQueryInterface();
  console.log('Attempting to repair database by dropping backup table...');

  try {
    await queryInterface.dropTable('hochschuhl_abc_backup');
    console.log('✓ Successfully dropped the inconsistent backup table.');
    console.log('Database should now be in a clean state.');
  } catch (error) {
    // It's okay if the table doesn't exist, the goal is to ensure it's gone.
    if (error.message.includes('no such table')) {
      console.log('Backup table not found, which is okay. Database is clean.');
    } else {
      console.error('Error dropping backup table:', error.message);
    }
  }
}

if (require.main === module) {
  repairDatabase();
}
