const { sequelize, UserSessions, ArticleViews, ChatInteractions } = require('../controllers/db.cjs');

async function createDashboardTables() {
    try {
        console.log('Creating dashboard tables...');
        
        // Force sync only the new tables
        await UserSessions.sync({ force: false });
        console.log('✓ UserSessions table created/updated');
        
        await ArticleViews.sync({ force: false });
        console.log('✓ ArticleViews table created/updated');
        
        await ChatInteractions.sync({ force: false });
        console.log('✓ ChatInteractions table created/updated');
        
        console.log('\n✓ All dashboard tables created successfully!');
        console.log('\nNew tables:');
        console.log('- user_sessions: Tracks user sessions and basic statistics');
        console.log('- article_views: Tracks which articles are viewed in context of questions');
        console.log('- chat_interactions: Tracks all chat interactions with success metrics');
        
    } catch (error) {
        console.error('Error creating dashboard tables:', error);
        throw error;
    } finally {
        await sequelize.close();
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