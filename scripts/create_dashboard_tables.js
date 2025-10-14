const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function createDashboardTables(closeConnection = true) {
    try {
        console.log('Ensuring dashboard tables exist...');

        // Schema is already pushed by auth script, but ensure
        await execAsync('npx prisma db push --accept-data-loss');
        console.log('✓ Dashboard tables ensured');

        console.log('\n✓ All dashboard tables ready!');
        console.log('\nTables:');
        console.log('- user_sessions: Tracks user sessions and basic statistics');
        console.log('- article_views: Tracks which articles are viewed in context of questions');
        console.log('- chat_interactions: Tracks all chat interactions with success metrics');

    } catch (error) {
        console.error('Error ensuring dashboard tables:', error);
        throw error;
    }
}

// Run the migration
if (require.main === module) {
    createDashboardTables()
        .then(() => {
            console.log('\nMigration completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\nMigration failed:', error);
            process.exit(1);
        });
}

module.exports = createDashboardTables;