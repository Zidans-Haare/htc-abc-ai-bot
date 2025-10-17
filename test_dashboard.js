const { PrismaClient } = require('./server/lib/generated/prisma');

const prisma = new PrismaClient();

async function testDashboard() {
    try {
        console.log('Testing Dashboard API endpoints...\n');

        // Test database connection
        await prisma.$connect();
        console.log('✓ Database connection established');

        // Test basic queries
        const totalSessions = await prisma.user_sessions.count();
        console.log(`✓ Total sessions: ${totalSessions}`);

        const totalInteractions = await prisma.chat_interactions.count();
        console.log(`✓ Total interactions: ${totalInteractions}`);

        const totalArticleViews = await prisma.article_views.count();
        console.log(`✓ Total article views: ${totalArticleViews}`);

        const activeArticles = await prisma.hochschuhl_abc.count({ where: { active: true } });
        console.log(`✓ Active articles: ${activeArticles}`);

        const openQuestions = await prisma.questions.count({
            where: {
                answered: false,
                spam: false,
                deleted: false
            }
        });
        console.log(`✓ Open questions: ${openQuestions}`);

        const totalFeedback = await prisma.feedback.count();
        console.log(`✓ Total feedback: ${totalFeedback}`);

        // Test complex queries
        console.log('\nTesting complex dashboard queries...');

        // Test sessions over time query
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const sessions = await prisma.$queryRaw`
            SELECT
                DATE(started_at) as date,
                COUNT(*) as count
            FROM user_sessions
            WHERE started_at >= ${sevenDaysAgo.toISOString()}
            GROUP BY DATE(started_at)
            ORDER BY date ASC
        `;

        console.log(`✓ Sessions over time query: ${sessions.length} days of data`);

        // Test most viewed articles
        const articles = await prisma.$queryRaw`
            SELECT
                h.article,
                COUNT(av.id) as views
            FROM hochschul_abc h
            LEFT JOIN article_views av ON h.id = av.article_id
            WHERE h.active = 1
            GROUP BY h.id, h.article
            HAVING views > 0
            ORDER BY views DESC
            LIMIT 5
        `;

        console.log(`✓ Most viewed articles query: ${articles.length} articles with views`);

        console.log('\n✅ All dashboard tests passed!');

    } catch (error) {
        console.error('❌ Dashboard test failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
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