const express = require('express');
const { Op } = require('sequelize');
const { sequelize, UserSessions, ChatInteractions, ArticleViews, HochschuhlABC, Questions, Feedback } = require('./db.cjs');

const router = express.Router();

router.get('/kpis', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        // Total Sessions
        const totalSessions = await UserSessions.count();

        // Today's Sessions
        const todaySessions = await UserSessions.count({
            where: {
                started_at: {
                    [Op.between]: [today, todayEnd]
                }
            }
        });

        // Success Rate - fallback to Questions table if ChatInteractions is empty
        let totalInteractions = await ChatInteractions.count();
        let successfulInteractions = await ChatInteractions.count({
            where: { was_successful: true }
        });
        
        // Fallback to Questions table if ChatInteractions is empty
        if (totalInteractions === 0) {
            const totalQuestions = await Questions.count({
                where: { spam: false, deleted: false }
            });
            const answeredQuestions = await Questions.count({
                where: { answered: true, spam: false, deleted: false }
            });
            
            totalInteractions = totalQuestions;
            successfulInteractions = answeredQuestions;
        }
        
        const successRate = totalInteractions > 0 
            ? Math.round((successfulInteractions / totalInteractions) * 100) 
            : 0;

        // Open Questions (unanswered questions)
        const openQuestions = await Questions.count({
            where: { 
                answered: false,
                spam: false,
                deleted: false
            }
        });

        res.json({
            totalSessions,
            todaySessions,
            successRate,
            openQuestions
        });
    } catch (error) {
        console.error('Error fetching KPIs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/unanswered-questions', async (req, res) => {
    try {
        // Group similar questions with better normalization (multilingual)
        const questions = await sequelize.query(`
            SELECT 
                MIN(q.question) as question,
                COUNT(*) as count,
                GROUP_CONCAT(DISTINCT q.question) as similar_questions
            FROM questions q
            WHERE q.answered = 0 
                AND q.spam = 0 
                AND q.deleted = 0
            GROUP BY 
                LOWER(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(
                                            REPLACE(
                                                REPLACE(
                                                    REPLACE(
                                                        REPLACE(
                                                            REPLACE(TRIM(q.question), '?', ''),
                                                            '.', ''
                                                        ),
                                                        '!', ''
                                                    ),
                                                    'where is', 'wo ist'
                                                ),
                                                'how is', 'wie ist'
                                            ),
                                            'what is', 'was ist'
                                        ),
                                        'when is', 'wann ist'
                                    ),
                                    'canteen', 'mensa'
                                ),
                                'cafeteria', 'mensa'
                            ),
                            'library', 'bibliothek'
                        ),
                        '  ', ' '
                    )
                )
            ORDER BY count DESC
            LIMIT 5
        `, {
            type: sequelize.QueryTypes.SELECT
        });

        const formattedQuestions = questions.map(q => ({
            question: q.question,
            count: q.count,
            similar_questions: q.similar_questions ? q.similar_questions.split(',').filter(sq => sq.trim()) : [q.question]
        }));

        res.json(formattedQuestions);
    } catch (error) {
        console.error('Error fetching unanswered questions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/recent-feedback', async (req, res) => {
    try {
        const recentFeedback = await Feedback.findAll({
            order: [['timestamp', 'DESC']],
            limit: 5,
            attributes: ['feedback_text', 'timestamp']
        });

        res.json(recentFeedback);
    } catch (error) {
        console.error('Error fetching recent feedback:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/sessions', async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // First try user_sessions, then fallback to feedback data as proxy for activity
        // Use German timezone for date grouping
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const isDST = currentMonth >= 3 && currentMonth <= 10; // March to October (approximate DST)
        const timezoneOffset = isDST ? '+2 hours' : '+1 hour';
        
        let sessions = await sequelize.query(`
            SELECT 
                DATE(datetime(started_at, ?)) as date,
                COUNT(*) as count
            FROM user_sessions 
            WHERE datetime(started_at, ?) >= datetime(?, ?)
            GROUP BY DATE(datetime(started_at, ?))
            ORDER BY date ASC
        `, {
            replacements: [timezoneOffset, timezoneOffset, sevenDaysAgo.toISOString(), timezoneOffset, timezoneOffset],
            type: sequelize.QueryTypes.SELECT
        });

        // If no user_sessions data, use feedback as activity proxy
        if (sessions.length === 0) {
            sessions = await sequelize.query(`
                SELECT 
                    DATE(datetime(timestamp, ?)) as date,
                    COUNT(DISTINCT conversation_id) as count
                FROM feedback 
                WHERE datetime(timestamp, ?) >= datetime(?, ?)
                GROUP BY DATE(datetime(timestamp, ?))
                ORDER BY date ASC
            `, {
                replacements: [timezoneOffset, timezoneOffset, sevenDaysAgo.toISOString(), timezoneOffset, timezoneOffset],
                type: sequelize.QueryTypes.SELECT
            });
        }

        // If still no data, use questions as activity proxy
        if (sessions.length === 0) {
            sessions = await sequelize.query(`
                SELECT 
                    DATE(datetime(lastUpdated, ?)) as date,
                    COUNT(*) as count
                FROM questions 
                WHERE datetime(lastUpdated, ?) >= datetime(?, ?)
                    AND spam = 0 
                    AND deleted = 0
                GROUP BY DATE(datetime(lastUpdated, ?))
                ORDER BY date ASC
            `, {
                replacements: [timezoneOffset, timezoneOffset, sevenDaysAgo.toISOString(), timezoneOffset, timezoneOffset],
                type: sequelize.QueryTypes.SELECT
            });
        }

        // Fill missing days with 0
        const result = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const existingSession = sessions.find(s => s.date === dateStr);
            result.push({
                date: dateStr,
                count: existingSession ? parseInt(existingSession.count) : 0
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/sessions/hourly', async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD format)' });
        }

        // Parse the date and create start/end of day in local timezone
        const targetDate = new Date(date + 'T00:00:00');
        const nextDay = new Date(date + 'T23:59:59.999');

        // First try user_sessions for hourly data (SQLite syntax with German timezone)
        // Germany is UTC+1 (winter) or UTC+2 (summer), so we add 2 hours to be safe for summer time
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const isDST = currentMonth >= 3 && currentMonth <= 10; // March to October (approximate DST)
        const timezoneOffset = isDST ? '+2 hours' : '+1 hour';
        
        let hourlyData = await sequelize.query(`
            SELECT 
                CAST(strftime('%H', datetime(started_at, ?)) AS INTEGER) as hour,
                COUNT(*) as count
            FROM user_sessions 
            WHERE DATE(datetime(started_at, ?)) = ?
            GROUP BY strftime('%H', datetime(started_at, ?))
            ORDER BY hour ASC
        `, {
            replacements: [timezoneOffset, timezoneOffset, date, timezoneOffset],
            type: sequelize.QueryTypes.SELECT
        });

        // If no user_sessions data, use feedback as activity proxy
        if (hourlyData.length === 0) {
            hourlyData = await sequelize.query(`
                SELECT 
                    CAST(strftime('%H', datetime(timestamp, ?)) AS INTEGER) as hour,
                    COUNT(DISTINCT conversation_id) as count
                FROM feedback 
                WHERE DATE(datetime(timestamp, ?)) = ?
                GROUP BY strftime('%H', datetime(timestamp, ?))
                ORDER BY hour ASC
            `, {
                replacements: [timezoneOffset, timezoneOffset, date, timezoneOffset],
                type: sequelize.QueryTypes.SELECT
            });
        }

        // If still no data, use questions as activity proxy
        if (hourlyData.length === 0) {
            hourlyData = await sequelize.query(`
                SELECT 
                    CAST(strftime('%H', datetime(lastUpdated, ?)) AS INTEGER) as hour,
                    COUNT(*) as count
                FROM questions 
                WHERE DATE(datetime(lastUpdated, ?)) = ?
                    AND spam = 0 
                    AND deleted = 0
                GROUP BY strftime('%H', datetime(lastUpdated, ?))
                ORDER BY hour ASC
            `, {
                replacements: [timezoneOffset, timezoneOffset, date, timezoneOffset],
                type: sequelize.QueryTypes.SELECT
            });
        }

        // Fill missing hours with 0 (0-23)
        const result = [];
        for (let hour = 0; hour < 24; hour++) {
            const existingHour = hourlyData.find(h => parseInt(h.hour) === hour);
            result.push({
                hour: hour,
                count: existingHour ? parseInt(existingHour.count) : 0
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching hourly sessions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/most-viewed-articles', async (req, res) => {
    try {
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

        res.json(articles);
    } catch (error) {
        console.error('Error fetching most viewed articles:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/feedback-stats', async (req, res) => {
    try {
        // Simple positive/negative classification based on keywords
        const positiveFeedback = await Feedback.count({
            where: {
                feedback_text: {
                    [Op.or]: [
                        { [Op.like]: '%gut%' },
                        { [Op.like]: '%super%' },
                        { [Op.like]: '%toll%' },
                        { [Op.like]: '%danke%' },
                        { [Op.like]: '%hilfreich%' },
                        { [Op.like]: '%perfekt%' },
                        { [Op.like]: '%klasse%' }
                    ]
                }
            }
        });

        const negativeFeedback = await Feedback.count({
            where: {
                feedback_text: {
                    [Op.or]: [
                        { [Op.like]: '%schlecht%' },
                        { [Op.like]: '%fehler%' },
                        { [Op.like]: '%falsch%' },
                        { [Op.like]: '%problem%' },
                        { [Op.like]: '%schwierig%' },
                        { [Op.like]: '%unverständlich%' }
                    ]
                }
            }
        });

        // Feedback over time (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const feedbackOverTime = await sequelize.query(`
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as count
            FROM feedback 
            WHERE timestamp >= ?
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `, {
            replacements: [sevenDaysAgo.toISOString()],
            type: sequelize.QueryTypes.SELECT
        });

        res.json({
            positiveFeedback,
            negativeFeedback,
            feedbackOverTime
        });
    } catch (error) {
        console.error('Error fetching feedback stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/content-stats', async (req, res) => {
    try {
        const activeArticles = await HochschuhlABC.count({
            where: { active: true }
        });

        const archivedArticles = await HochschuhlABC.count({
            where: { active: false }
        });

        res.json({
            activeArticles,
            archivedArticles
        });
    } catch (error) {
        console.error('Error fetching content stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/top-questions', async (req, res) => {
    try {
        // Top 5 häufigste Fragen (egal ob beantwortet oder nicht)
        const questions = await sequelize.query(`
            SELECT 
                MIN(q.question) as question,
                COUNT(*) as count,
                GROUP_CONCAT(DISTINCT q.question) as similar_questions,
                SUM(CASE WHEN q.answered = 1 THEN 1 ELSE 0 END) as answered_count,
                SUM(CASE WHEN q.answered = 0 THEN 1 ELSE 0 END) as unanswered_count
            FROM questions q
            WHERE q.spam = 0 
                AND q.deleted = 0
            GROUP BY 
                LOWER(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(
                                            REPLACE(
                                                REPLACE(
                                                    REPLACE(
                                                        REPLACE(
                                                            REPLACE(TRIM(q.question), '?', ''),
                                                            '.', ''
                                                        ),
                                                        '!', ''
                                                    ),
                                                    'where is', 'wo ist'
                                                ),
                                                'how is', 'wie ist'
                                            ),
                                            'what is', 'was ist'
                                        ),
                                        'when is', 'wann ist'
                                    ),
                                    'canteen', 'mensa'
                                ),
                                'cafeteria', 'mensa'
                            ),
                            'library', 'bibliothek'
                        ),
                        '  ', ' '
                    )
                )
            ORDER BY count DESC
            LIMIT 5
        `, {
            type: sequelize.QueryTypes.SELECT
        });

        const formattedQuestions = questions.map(q => ({
            question: q.question,
            count: q.count,
            answered_count: q.answered_count || 0,
            unanswered_count: q.unanswered_count || 0,
            is_answered: q.answered_count > 0,
            similar_questions: q.similar_questions ? q.similar_questions.split(',').filter(sq => sq.trim()) : [q.question]
        }));

        res.json(formattedQuestions);
    } catch (error) {
        console.error('Error fetching top questions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;