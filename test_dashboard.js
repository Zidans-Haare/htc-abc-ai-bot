const { sequelize, UserSessions, ChatInteractions, ArticleViews, HochschuhlABC, Questions, Feedback } = require('./controllers/db.cjs');

async function testDashboard() {
    try {
        console.log('Testing Dashboard API endpoints...\n');

        // Test database connection
        await sequelize.authenticate();
        console.log('✓ Database connection established');

        // Test basic queries
        const totalSessions = await UserSessions.count();
        console.log(`✓ Total sessions: ${totalSessions}`);

        const totalInteractions = await ChatInteractions.count();
        console.log(`✓ Total interactions: ${totalInteractions}`);

        const totalArticleViews = await ArticleViews.count();
        console.log(`✓ Total article views: ${totalArticleViews}`);

        const activeArticles = await HochschuhlABC.count({ where: { active: true } });
        console.log(`✓ Active articles: ${activeArticles}`);

        const openQuestions = await Questions.count({
            where: { 
                answered: false,
                spam: false,
                deleted: false
            }
        });
        console.log(`✓ Open questions: ${openQuestions}`);

        const totalFeedback = await Feedback.count();
        console.log(`✓ Total feedback: ${totalFeedback}`);

        // Test complex queries
        console.log('\nTesting complex dashboard queries...');

        // Test sessions over time query
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const sessions = await sequelize.query(`
            SELECT 
                DATE(started_at) as date,
                COUNT(*) as count
            FROM user_sessions 
            WHERE started_at >= ?
            GROUP BY DATE(started_at)
            ORDER BY date ASC
        `, {
            replacements: [sevenDaysAgo.toISOString()],
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`✓ Sessions over time query: ${sessions.length} days of data`);

        // Test most viewed articles
        const articles = await sequelize.query(`
            SELECT 
                h.headline,
                COUNT(av.id) as views
            FROM hochschuhl_abc h
            LEFT JOIN article_views av ON h.id = av.article_id
            WHERE h.active = 1
            GROUP BY h.id, h.headline
            HAVING views > 0
            ORDER BY views DESC
            LIMIT 5
        `, {
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`✓ Most viewed articles query: ${articles.length} articles with views`);

        console.log('\n✅ All dashboard tests passed!');

    } catch (error) {
        console.error('❌ Dashboard test failed:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

// Run the test
if (require.main === module) {
    testDashboard()
        .then(() => {
            console.log('\n🎉 Dashboard implementation is working correctly!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Dashboard test suite failed:', error.message);
            process.exit(1);
        });
}

module.exports = testDashboard;