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

// Helper function to normalize questions for similarity matching
function normalizeQuestion(question) {
    if (!question) return '';
    
    return question
        .toLowerCase()
        .trim()
        // Remove punctuation and special characters
        .replace(/[^\w\säöüß]/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Remove common German/English stop words and question prefixes
        .replace(/^(wo ist|where is|was ist|what is|wie ist|how is|wer ist|who is|wie|how|wo|where|was|what|wer|who)\s+/g, '')
        .replace(/^(der|die|das|the|a|an|ein|eine)\s+/g, '')
        // Remove filler words
        .replace(/\b(denn|eigentlich|genau|nochmal|noch|mal|please|bitte)\b/g, '')
        // Normalize whitespace again
        .replace(/\s+/g, ' ')
        .trim();
}

// Calculate simple similarity score between two normalized strings
function calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;
    
    // Convert to word arrays
    const words1 = str1.split(' ').filter(w => w.length > 0);
    const words2 = str2.split(' ').filter(w => w.length > 0);
    
    if (words1.length === 0 || words2.length === 0) return 0.0;
    
    // Calculate Jaccard similarity (intersection over union of words)
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
}

// Group similar questions together
function groupSimilarQuestions(questions, threshold = 0.6) {
    const groups = [];
    const processed = new Set();
    
    questions.forEach((question, index) => {
        if (processed.has(index)) return;
        
        const currentGroup = {
            representative: question,
            normalized: normalizeQuestion(question),
            similar: [question],
            count: 1
        };
        
        // Find similar questions
        questions.forEach((otherQuestion, otherIndex) => {
            if (otherIndex === index || processed.has(otherIndex)) return;
            
            const similarity = calculateSimilarity(
                normalizeQuestion(question),
                normalizeQuestion(otherQuestion)
            );
            
            if (similarity >= threshold) {
                currentGroup.similar.push(otherQuestion);
                currentGroup.count++;
                processed.add(otherIndex);
            }
        });
        
        processed.add(index);
        groups.push(currentGroup);
    });
    
    return groups;
}

// Get top 5 unanswered questions with intelligent grouping
router.get('/unanswered-questions', async (req, res) => {
    try {
        // Get all unanswered questions
        const questionsData = await Questions.findAll({
            attributes: ['question'],
            where: { answered: false }
        });

        const questions = questionsData.map(q => q.question).filter(q => q && q.trim().length > 0);
        
        // Group similar questions
        const groups = groupSimilarQuestions(questions);
        
        // Sort by count and return top 5
        const topGroups = groups
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(group => ({
                question: group.representative,
                normalized: group.normalized,
                count: group.count,
                similar_questions: group.similar.slice(0, 3) // Show max 3 similar examples
            }));

        res.json(topGroups);
    } catch (err) {
        console.error('Failed to get unanswered questions', err);
        res.status(500).json({ error: 'Failed to get unanswered questions' });
    }
});

// Get top 5 most frequent questions (all questions, not just unanswered)
router.get('/top-questions', async (req, res) => {
    try {
        // Get all questions
        const questionsData = await Questions.findAll({
            attributes: ['question']
        });

        const questions = questionsData.map(q => q.question).filter(q => q && q.trim().length > 0);
        
        // Group similar questions
        const groups = groupSimilarQuestions(questions);
        
        // Sort by count and return top 5 (only groups with more than 1 question)
        const topGroups = groups
            .filter(group => group.count > 1)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(group => ({
                question: group.representative,
                normalized: group.normalized,
                count: group.count,
                similar_questions: group.similar.slice(0, 3) // Show max 3 similar examples
            }));

        res.json(topGroups);
    } catch (err) {
        console.error('Failed to get top questions', err);
        res.status(500).json({ error: 'Failed to get top questions' });
    }
});

// Debug endpoint to see all grouped questions
router.get('/debug-groups', async (req, res) => {
    try {
        const questionsData = await Questions.findAll({
            attributes: ['question']
        });

        const questions = questionsData.map(q => q.question).filter(q => q && q.trim().length > 0);
        const groups = groupSimilarQuestions(questions);
        
        const allGroups = groups
            .sort((a, b) => b.count - a.count)
            .map(group => ({
                question: group.representative,
                normalized: group.normalized,
                count: group.count,
                all_similar: group.similar
            }));

        res.json(allGroups);
    } catch (err) {
        console.error('Failed to get debug groups', err);
        res.status(500).json({ error: 'Failed to get debug groups' });
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
