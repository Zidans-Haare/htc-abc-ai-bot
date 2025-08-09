const { sequelize } = require('../controllers/db.cjs');

async function addConversationIdToQuestions() {
    try {
        await sequelize.getQueryInterface().addColumn('questions', 'conversationId', {
            type: sequelize.Sequelize.STRING,
            allowNull: true
        });
        console.log('Column added');
    } catch (err) {
        console.error('Failed to add column', err);
    }
}

addConversationIdToQuestions();
