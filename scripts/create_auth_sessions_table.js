const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function createAuthSessionsTable(closeConnection = true) {
    try {
        console.log('Ensuring database schema is up to date...');

        // Use Prisma to push schema to DB
        await execAsync('npx prisma db push --accept-data-loss');
        console.log('✓ Database schema updated');

        console.log('\n✓ Auth sessions table ensured!');
        console.log('\nTable:');
        console.log('- auth_sessions: Stores authentication sessions with expiration and activity tracking');

    } catch (error) {
        console.error('Error updating database schema:', error);
        throw error;
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