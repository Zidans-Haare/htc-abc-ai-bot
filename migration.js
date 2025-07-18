const { sequelize } = require('./controllers/db.cjs');

async function migrate() {
  try {
    await sequelize.query('ALTER TABLE `hochschuhl_abc` RENAME COLUMN `lastUpdated` TO `createdAt`');
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sequelize.close();
  }
}

migrate();
