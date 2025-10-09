#!/usr/bin/env node

const cron = require('node-cron');
const { sequelize, Message, Conversation } = require('../controllers/db.cjs');

// Optional import for question grouper (requires server-side OpenAI-compatible API key)
let groupSimilarQuestions, extractQuestions;
try {
    const questionGrouper = require('../utils/questionGrouper');
    groupSimilarQuestions = questionGrouper.groupSimilarQuestions;
    extractQuestions = questionGrouper.extractQuestions;
} catch (error) {
    console.warn('Question grouper not available (CHAT_AI_TOKEN/OPENAI_API_KEY/KISSKI_API_KEY not set)');
    process.exit(1);
}

class DailyAnalysisScheduler {
    constructor() {
        this.isRunning = false;
    }

    async performDailyAnalysis() {
        if (this.isRunning) {
            console.log('Daily analysis already running, skipping...');
            return;
        }

        this.isRunning = true;
        console.log(`[${new Date().toISOString()}] Starting daily question analysis...`);

        try {
            // Get all user messages from the last 30 days for comprehensive analysis
            const recentMessages = await Message.findAll({
                where: {
                    role: 'user',
                    created_at: {
                        [sequelize.Sequelize.Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                },
                attributes: ['content', 'role', 'created_at'],
                order: [['created_at', 'DESC']],
                raw: true
            });

            console.log(`Found ${recentMessages.length} messages to analyze`);

            if (recentMessages.length === 0) {
                console.log('No messages to analyze');
                return;
            }

            // Extract questions
            const questions = extractQuestions(recentMessages);
            console.log(`Extracted ${questions.length} questions`);

            if (questions.length === 0) {
                console.log('No questions extracted');
                return;
            }

            // Process with AI grouping (this will use caching automatically)
            const groupingResult = await groupSimilarQuestions(questions, false); // Force fresh analysis
            
            console.log(`Analysis completed: ${groupingResult.results.length} question groups identified`);

            // Store results in a daily statistics table (create if needed)
            await this.storeDailyStatistics(groupingResult.results);

            console.log(`[${new Date().toISOString()}] Daily analysis completed successfully`);

        } catch (error) {
            console.error('Daily analysis failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async storeDailyStatistics(questionGroups) {
        // Create daily statistics table if it doesn't exist
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS daily_question_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_date TEXT NOT NULL,
                normalized_question TEXT NOT NULL,
                question_count INTEGER NOT NULL,
                topic TEXT,
                languages_detected TEXT,
                original_questions TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Clear today's statistics
        const today = new Date().toISOString().split('T')[0];
        await sequelize.query('DELETE FROM daily_question_stats WHERE analysis_date = ?', {
            replacements: [today],
            type: sequelize.QueryTypes.DELETE
        });

        // Insert new statistics
        const statsData = questionGroups.map(group => ({
            analysis_date: today,
            normalized_question: group.normalized_question,
            question_count: group.question_count,
            topic: group.topic,
            languages_detected: JSON.stringify(group.languages_detected),
            original_questions: JSON.stringify(group.original_questions)
        }));

        if (statsData.length > 0) {
            // Bulk insert
            const placeholders = statsData.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
            const values = statsData.flatMap(stat => [
                stat.analysis_date,
                stat.normalized_question,
                stat.question_count,
                stat.topic,
                stat.languages_detected,
                stat.original_questions
            ]);

            await sequelize.query(
                `INSERT INTO daily_question_stats (analysis_date, normalized_question, question_count, topic, languages_detected, original_questions) VALUES ${placeholders}`,
                {
                    replacements: values,
                    type: sequelize.QueryTypes.INSERT
                }
            );

            console.log(`Stored ${statsData.length} question statistics for ${today}`);
        }
    }

    start() {
        console.log('Daily Analysis Scheduler started');
        
        // Schedule daily analysis at midnight (00:00)
        cron.schedule('0 0 * * *', () => {
            this.performDailyAnalysis();
        });

        // For testing: also run every hour during development
        // cron.schedule('0 * * * *', () => {
        //     console.log('Running hourly analysis for testing...');
        //     this.performDailyAnalysis();
        // });

        console.log('Scheduled daily analysis at 00:00 each day');
    }

    // Manual trigger for testing
    async runNow() {
        console.log('Running daily analysis manually...');
        await this.performDailyAnalysis();
    }
}

// If run directly, start the scheduler
if (require.main === module) {
    const scheduler = new DailyAnalysisScheduler();
    
    // Check for manual run
    if (process.argv.includes('--run-now')) {
        scheduler.runNow().then(() => process.exit(0));
    } else {
        scheduler.start();
    }
}

module.exports = DailyAnalysisScheduler;
