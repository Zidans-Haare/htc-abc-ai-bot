const { sequelize } = require('../controllers/db.cjs');

async function updateForeignKeyConstraint() {
  const queryInterface = sequelize.getQueryInterface();
  console.log('Attempting to update foreign key constraint for chat_interactions...');

  try {
    // This is a complex operation. In a real-world scenario with data,
    // we would need to drop and recreate the table carefully.
    // For SQLite, it's often easier to recreate the table.
    // As this is a new feature, we can assume the table is empty.

    // 1. Drop the existing table
    await queryInterface.dropTable('chat_interactions');
    console.log('Dropped existing chat_interactions table.');

    // 2. Recreate the table with the correct foreign key constraint
    await queryInterface.createTable('chat_interactions', {
      id: {
        type: 'INTEGER',
        autoIncrement: true,
        primaryKey: true
      },
      session_id: {
        type: 'STRING',
        allowNull: false,
        references: {
          model: 'user_sessions', // Correct table name
          key: 'session_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // More robust relationship
      },
      question: {
        type: 'TEXT',
        allowNull: false
      },
      answer: {
        type: 'TEXT',
        allowNull: true
      },
      was_successful: {
        type: 'BOOLEAN',
        defaultValue: false
      },
      response_time_ms: {
        type: 'INTEGER',
        allowNull: true
      },
      tokens_used: {
        type: 'INTEGER',
        allowNull: true
      },
      timestamp: {
        type: 'DATETIME',
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
      },
      error_message: {
        type: 'TEXT',
        allowNull: true
      }
    });
    console.log('✓ Recreated "chat_interactions" table with updated foreign key.');

  } catch (error) {
    console.error('Error updating foreign key constraint:', error.message);
  }
}

if (require.main === module) {
  updateForeignKeyConstraint();
}

module.exports = updateForeignKeyConstraint;
