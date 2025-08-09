const express = require('express');
const router = express.Router();
const { sequelize, HochschuhlABC, Questions, Feedback } = require('./db.cjs');
const { Op } = require('sequelize');

// Helper function to get the start date for the last 7 days
const getStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
};

// Get KPIs
router.get('/kpis', async (req, res) => {
    try {
        const totalSessions = await Questions.count({ where: { conversationId: { [Op.ne]: null } }, distinct: true, col: 'conversationId' });
        console.log('Total sessions:', totalSessions);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySessions = await Questions.count({
            where: {
                conversationId: { [Op.ne]: null },
                lastUpdated: { [Op.gte]: today }
            },
            distinct: true,
            col: 'conversationId'
        });
        const answeredQuestions = await Questions.count({ where: { answered: true } });
        const openQuestions = await Questions.count({ where: { answered: false } });

        const successRate = totalSessions > 0 ? (answeredQuestions / totalSessions) * 100 : 0;

        res.json({
            totalSessions,
            successRate: successRate.toFixed(2),
            feedbackScore: "N/A", // Placeholder
            openQuestions,
            todaySessions
        });
    } catch (err) {
        console.error('Failed to get KPIs', err);
        res.status(500).json({ error: 'Failed to get KPIs' });
    }
});

// Get top 5 unanswered questions
router.get('/unanswered-questions', async (req, res) => {
    try {
        const questions = await Questions.findAll({
            attributes: ['question', [sequelize.fn('count', sequelize.col('question')), 'count']],
            where: { answered: false },
            group: ['question'],
            order: [[sequelize.fn('count', sequelize.col('question')), 'DESC']],
            limit: 5
        });
        res.json(questions);
    } catch (err) {
        console.error('Failed to get unanswered questions', err);
        res.status(500).json({ error: 'Failed to get unanswered questions' });
    }
});

// Get last 3 feedbacks
router.get('/recent-feedback', async (req, res) => {
    try {
        const feedback = await Feedback.findAll({
            order: [['timestamp', 'DESC']],
            limit: 3
        });
        res.json(feedback);
    } catch (err) {
        console.error('Failed to get recent feedback', err);
        res.status(500).json({ error: 'Failed to get recent feedback' });
    }
});

// Get sessions for the last 7 days
router.get('/sessions', async (req, res) => {
    try {
        const sessions = await Questions.findAll({
            attributes: [
                [sequelize.fn('date', sequelize.col('lastUpdated')), 'date'],
                [sequelize.fn('count', sequelize.fn('DISTINCT', sequelize.col('conversationId'))), 'count']
            ],
            where: {
                lastUpdated: {
                    [Op.gte]: getStartDate()
                },
                conversationId: { [Op.ne]: null }
            },
            group: ['date'],
            order: [['date', 'ASC']]
        });
        console.log('Session data for graph:', sessions);
        res.json(sessions);
    } catch (err) {
        console.error('Failed to get session data', err);
        res.status(500).json({ error: 'Failed to get session data' });
    }
});

// Get most viewed articles
router.get('/most-viewed-articles', async (req, res) => {
    try {
        const articles = await HochschuhlABC.findAll({
            order: [['views', 'DESC']],
            limit: 5
        });
        res.json(articles);
    } catch (err) {
        console.error('Failed to get most viewed articles', err);
        res.status(500).json({ error: 'Failed to get most viewed articles' });
    }
});

// Get feedback stats
router.get('/feedback-stats', async (req, res) => {
    try {
        const positiveFeedback = await Feedback.count({ where: { feedback_text: { [Op.like]: '%positive%' } } });
        const negativeFeedback = await Feedback.count({ where: { feedback_text: { [Op.like]: '%negative%' } } });

        const feedbackOverTime = await Feedback.findAll({
            attributes: [
                [sequelize.fn('date', sequelize.col('timestamp')), 'date'],
                [sequelize.fn('count', sequelize.col('id')), 'count']
            ],
            where: {
                timestamp: {
                    [Op.gte]: getStartDate()
                }
            },
            group: ['date'],
            order: [['date', 'ASC']]
        });

        res.json({ positiveFeedback, negativeFeedback, feedbackOverTime });
    } catch (err) {
        console.error('Failed to get feedback stats', err);
        res.status(500).json({ error: 'Failed to get feedback stats' });
    }
});

// Get content stats
router.get('/content-stats', async (req, res) => {
    try {
        const activeArticles = await HochschuhlABC.count({ where: { active: true, archived: null } });
        const archivedArticles = await HochschuhlABC.count({ where: { archived: { [Op.ne]: null } } });

        const topEditors = await HochschuhlABC.findAll({
            attributes: ['editor', [sequelize.fn('count', sequelize.col('editor')), 'count']],
            group: ['editor'],
            order: [[sequelize.fn('count', sequelize.col('editor')), 'DESC']],
            limit: 3
        });

        res.json({ activeArticles, archivedArticles, topEditors });
    } catch (err) {
        console.error('Failed to get content stats', err);
        res.status(500).json({ error: 'Failed to get content stats' });
    }
});

module.exports = router;
