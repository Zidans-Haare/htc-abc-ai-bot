const { HochschuhlABC } = require('../controllers/db.cjs');

async function addUpdatedAt() {
  try {
    const queryInterface = HochschuhlABC.sequelize.getQueryInterface();
    await queryInterface.addColumn('hochschuhl_abc', 'updated_at', {
      type: 'DATE',
      defaultValue: new Date(),
      allowNull: false
    });
    console.log('Added updated_at column to hochschuhl_abc');
  } catch (err) {
    console.error('Error adding column:', err);
  }
}

if (require.main === module) {
  addUpdatedAt();
}