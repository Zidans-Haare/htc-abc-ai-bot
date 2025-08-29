const { Conversation, Message } = require('../controllers/db.cjs');

// The synchronization function
async function createChatHistoryTables() {
  console.log('Attempting to sync chat history models...');
  try {
    // sequelize.sync() will create the tables if they don't exist
    await Conversation.sync();
    await Message.sync();
    console.log('✓ "conversations" and "messages" tables synced successfully.');
  } catch (error) {
    console.error('Error syncing chat history tables:', error.message);
  }
}

// If called directly from command line
if (require.main === module) {
  createChatHistoryTables();
}

module.exports = createChatHistoryTables;
