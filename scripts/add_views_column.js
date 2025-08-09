const { sequelize, HochschuhlABC } = require('../controllers/db.cjs');

async function addViewsColumn() {
    try {
        await sequelize.getQueryInterface().addColumn('hochschuhl_abc', 'views', {
            type: sequelize.Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: false
        });
        console.log('Column added');
    } catch (err) {
        console.error('Failed to add column', err);
    }
}

addViewsColumn();
