const { sequelize, AuthSession } = require('../controllers/db.cjs');

async function createAuthSessionsTable(closeConnection = true) {
    try {
        console.log('Creating auth_sessions table...');

        // Sync the AuthSession table
        await AuthSession.sync({ force: false });
        console.log('✓ AuthSession table created/updated');

        console.log('\n✓ Auth sessions table created successfully!');
        console.log('\nNew table:');
        console.log('- auth_sessions: Stores authentication sessions with expiration and activity tracking');

    } catch (error) {
        console.error('Error creating auth_sessions table:', error);
        throw error;
    } finally {
        if (closeConnection) {
            await sequelize.close();
        }
    }
}

// Run the migration
if (require.main === module) {
    createAuthSessionsTable()
        .then(() => {
            console.log('\nMigration completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\nMigration failed:', error);
            process.exit(1);
        });
}

module.exports = createAuthSessionsTable;