const { UserSessions, ChatInteractions, ArticleViews } = require('../controllers/db.cjs');
const crypto = require('crypto');

function generateSessionId(req) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const timestamp = Date.now();
    return crypto.createHash('sha256')
        .update(`${ip}-${userAgent}-${timestamp}`)
        .digest('hex')
        .substring(0, 32);
}

async function trackSession(req) {
    try {
        let sessionId = req.cookies?.sessionId;
        
        if (!sessionId) {
            sessionId = generateSessionId(req);
            // Set session cookie with 30 minutes expiry
            req.res?.cookie('sessionId', sessionId, {
                maxAge: 30 * 60 * 1000, // 30 minutes
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });
        }

        const session = await UserSessions.upsert({
            where: { session_id: sessionId },
            update: { last_activity: new Date() },
            create: {
                session_id: sessionId,
                ip_address: req.ip || req.connection.remoteAddress,
                user_agent: req.get('User-Agent'),
                started_at: new Date(),
                last_activity: new Date(),
                questions_count: 0,
                successful_answers: 0
            }
        });

        return sessionId;
    } catch (error) {
        console.error('Error tracking session:', error);
        return null;
    }
}

async function trackChatInteraction(sessionId, question, answer, wasSuccessful, responseTime, tokensUsed, errorMessage = null) {
    try {
        if (!sessionId) return;

        await ChatInteractions.create({
            data: {
                session_id: sessionId,
                question: question,
                answer: answer,
                was_successful: wasSuccessful,
                response_time_ms: responseTime,
                tokens_used: tokensUsed,
                timestamp: new Date(),
                error_message: errorMessage
            }
        });

        // Update session counters
        const current = await UserSessions.findUnique({ where: { session_id: sessionId } });
        if (current) {
            await UserSessions.update({
                where: { session_id: sessionId },
                data: {
                    questions_count: current.questions_count + 1,
                    successful_answers: current.successful_answers + (wasSuccessful ? 1 : 0)
                }
            });
        }

    } catch (error) {
        console.error('Error tracking chat interaction:', error);
    }
}

async function trackArticleView(articleId, sessionId, questionContext = null) {
    try {
        if (!articleId) return;

        await ArticleViews.create({
            data: {
                article_id: articleId,
                session_id: sessionId,
                viewed_at: new Date(),
                question_context: questionContext
            }
        });

    } catch (error) {
        console.error('Error tracking article view:', error);
    }
}

function extractArticleIds(response) {
    try {
        // Try to find article references in the response
        // This is a simple approach - could be improved with better parsing
        const articleIds = [];
        
        // Look for patterns like "siehe Artikel ID 5" or references to specific headlines
        const idMatches = response.match(/artikel\s+id\s*:?\s*(\d+)/gi);
        if (idMatches) {
            idMatches.forEach(match => {
                const id = match.match(/\d+/);
                if (id) articleIds.push(parseInt(id[0]));
            });
        }

        return [...new Set(articleIds)]; // Remove duplicates
    } catch (error) {
        console.error('Error extracting article IDs:', error);
        return [];
    }
}

module.exports = {
    trackSession,
    trackChatInteraction,
    trackArticleView,
    extractArticleIds
};