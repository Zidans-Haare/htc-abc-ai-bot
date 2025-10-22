const { QuestionAnalysisCache, prisma } = require('../controllers/db.cjs');
const { chatCompletion } = require('./aiProvider');
const crypto = require('crypto');



// Cache validity in hours
const CACHE_VALIDITY_HOURS = 6;

/**
 * Fetches existing categories from the database to ensure consistency
 * @returns {Promise<Array<string>>} - Array of existing category names
 */
async function getExistingCategories() {
    try {
        const categories = await prisma.$queryRaw`
            SELECT DISTINCT category
            FROM conversations
            WHERE category IS NOT NULL
              AND category != 'Unkategorisiert'
              AND category != ''
            ORDER BY category
        `;

        return categories.map(cat => cat.category);
    } catch (error) {
        console.error('[QuestionGrouper] Error fetching existing categories:', error);
        return []; // Return empty array as fallback
    }
}

/**
 * Groups similar questions together with caching support
 * @param {Array<string>} questions - Array of question strings
 * @param {boolean} useCache - Whether to use cached results
 * @returns {Promise<{results: Array<object>, isProcessing: boolean, progress: number}>} - Results with processing status
 */
async function groupSimilarQuestions(questions, useCache = true) {
    console.log(`[QuestionGrouper] Starting grouping for ${questions.length} questions...`);

    if (!questions || questions.length === 0) {
        return { results: [], isProcessing: false, progress: 100 };
    }

    // Filter out very short or invalid questions
    const validQuestions = questions.filter(q => 
        q && 
        q.length > 5 && 
        !q.includes('<%') && // No system messages
        (q.includes('?') || 
         q.toLowerCase().match(/^(wo|wie|was|wann|warum|welche|where|how|what|when|why|which|哪里|什么|如何|何时|为什么)/))
    );

    if (validQuestions.length === 0) {
        return { results: [], isProcessing: false, progress: 100 };
    }

    // Generate cache key based on questions content
    const cacheKey = generateCacheKey(validQuestions);
    
    if (useCache) {
        const cachedResults = await getCachedResults(cacheKey);
        if (cachedResults) {
            console.log(`[QuestionGrouper] Using cached results`);
            return { 
                results: cachedResults, 
                isProcessing: false, 
                progress: 100 
            };
        }
    }

    // Check if processing is already in progress
    const processingStatus = await getProcessingStatus(cacheKey);
    if (processingStatus.isProcessing) {
        return {
            results: processingStatus.partialResults,
            isProcessing: true,
            progress: processingStatus.progress
        };
    }

    // Start background processing
    processQuestionsInBackground(validQuestions, cacheKey);

    // Return immediate results if any exist
    return {
        results: await getPartialResults(cacheKey),
        isProcessing: true,
        progress: 0
    };
}

/**
 * Process questions in background and cache results
 */
async function processQuestionsInBackground(questions, cacheKey) {
    try {
        // Mark as processing
        await markAsProcessing(cacheKey, true);

        // Process in batches
        const batchSize = 10; // Smaller batches to avoid token limits
        const allGroups = [];
        let processed = 0;

        for (let i = 0; i < questions.length; i += batchSize) {
            const batch = questions.slice(i, i + batchSize);
            const batchGroups = await processBatch(batch);
            
            if (batchGroups) {
                allGroups.push(...batchGroups);
                
                // Update progress incrementally
                processed += batch.length;
                const progress = Math.round((processed / questions.length) * 100);
                
                // Save intermediate results
                const mergedGroups = mergeSimilarGroups(allGroups);
                await savePartialResults(cacheKey, mergedGroups, progress);
                
                console.log(`[QuestionGrouper] Progress: ${progress}% (${processed}/${questions.length})`);
            }
        }

        // Final merge and cache
        const finalGroups = mergeSimilarGroups(allGroups);
        await saveFinalResults(cacheKey, finalGroups);
        
        console.log(`[QuestionGrouper] Completed processing ${questions.length} questions`);

    } catch (error) {
        console.error('[QuestionGrouper] Background processing error:', error);
        await markAsProcessing(cacheKey, false);
    }
}

function generateCacheKey(questions) {
    const content = questions.sort().join('|');
    return crypto.createHash('md5').update(content).digest('hex');
}

async function getCachedResults(cacheKey) {
    try {
        const cached = await QuestionAnalysisCache.findMany({
            where: {
                cache_key: cacheKey,
                updated_at: {
                    gte: new Date(Date.now() - CACHE_VALIDITY_HOURS * 60 * 60 * 1000)
                },
                is_processing: false
            },
            orderBy: { question_count: 'desc' }
        });

        if (cached.length > 0) {
            return cached.map(row => ({
                normalized_question: row.normalized_question,
                question_count: row.question_count,
                topic: row.topic,
                languages_detected: JSON.parse(row.languages_detected || '[]'),
                original_questions: JSON.parse(row.original_questions || '[]')
            }));
        }
    } catch (error) {
        console.error('[QuestionGrouper] Cache retrieval error:', error);
    }
    return null;
}

async function getProcessingStatus(cacheKey) {
    try {
        const processing = await QuestionAnalysisCache.findMany({
            where: { cache_key: cacheKey, is_processing: true }
        });

        if (processing.length > 0) {
            const partialResults = processing.map(row => ({
                normalized_question: row.normalized_question,
                question_count: row.question_count,
                topic: row.topic,
                languages_detected: JSON.parse(row.languages_detected || '[]'),
                original_questions: JSON.parse(row.original_questions || '[]')
            }));

            return {
                isProcessing: true,
                partialResults,
                progress: 50 // Rough estimate
            };
        }
    } catch (error) {
        console.error('[QuestionGrouper] Processing status error:', error);
    }
    
    return { isProcessing: false, partialResults: [], progress: 0 };
}

async function getPartialResults(cacheKey) {
    try {
        const results = await QuestionAnalysisCache.findMany({
            where: { cache_key: cacheKey },
            orderBy: { question_count: 'desc' },
            take: 5
        });

        return results.map(row => ({
            normalized_question: row.normalized_question,
            question_count: row.question_count,
            topic: row.topic,
            languages_detected: JSON.parse(row.languages_detected || '[]'),
            original_questions: JSON.parse(row.original_questions || '[]')
        }));
    } catch (error) {
        console.error('[QuestionGrouper] Partial results error:', error);
        return [];
    }
}

async function markAsProcessing(cacheKey, processing) {
    try {
        await QuestionAnalysisCache.updateMany({
            where: { cache_key: cacheKey },
            data: { is_processing: processing }
        });
    } catch (error) {
        console.error('[QuestionGrouper] Mark processing error:', error);
    }
}

async function savePartialResults(cacheKey, groups, progress) {
    try {
        // Clear existing cache for this key
        await QuestionAnalysisCache.deleteMany({ where: { cache_key: cacheKey } });

        // Save new results
        const cacheEntries = groups.slice(0, 10).map(group => ({
            cache_key: cacheKey,
            normalized_question: group.normalized_question,
            question_count: group.question_count,
            topic: group.topic,
            languages_detected: JSON.stringify(group.languages_detected),
            original_questions: JSON.stringify(group.original_questions),
            is_processing: progress < 100,
            updated_at: new Date()
        }));

        await QuestionAnalysisCache.createMany({ data: cacheEntries });
    } catch (error) {
        console.error('[QuestionGrouper] Save partial results error:', error);
    }
}

async function saveFinalResults(cacheKey, groups) {
    await savePartialResults(cacheKey, groups, 100);
    await markAsProcessing(cacheKey, false);
}

async function processBatch(questions) {
    const questionsText = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    
    // Get existing categories to ensure consistency
    const existingCategories = await getExistingCategories();
    const categoriesText = existingCategories.length > 0 
        ? `\n        Verwende BEVORZUGT eine dieser bestehenden Kategorien für das "topic"-Feld:\n        ${existingCategories.map(cat => `- "${cat}"`).join('\n        ')}\n        Falls keine passt, erstelle eine neue passende Kategorie.\n`
        : '\n        Erstelle passende Kategorie-Namen für das "topic"-Feld.\n';

    const prompt = `
        Analysiere die folgenden Fragen und gruppiere ähnliche Fragen zusammen.
        Berücksichtige dabei:
        - Fragen in verschiedenen Sprachen (Deutsch, Englisch, Chinesisch, etc.)
        - Verschiedene Formulierungen derselben Frage
        - Synonyme und ähnliche Begriffe (Mensa=Cafeteria, Bibliothek=Library, etc.)
        ${categoriesText}
        Antworte ausschließlich mit einem JSON-Array von Gruppen. Jede Gruppe hat:
        - "normalized_question": Die normalisierte deutsche Frage als Repräsentant
        - "original_questions": Array der ursprünglichen Fragen (mit Nummern)
        - "question_count": Anzahl der Fragen in der Gruppe
        - "languages_detected": Array der erkannten Sprachen
        - "topic": Kurzes Thema/Kategorie der Frage (bevorzugt aus bestehenden Kategorien)
        
        Beispiel:
        [
            {
                "normalized_question": "Wo ist die Mensa?",
                "original_questions": ["1. Wo ist die Mensa?", "15. Where is the canteen?", "23. 食堂在哪里?"],
                "question_count": 3,
                "languages_detected": ["deutsch", "english", "chinese"],
                "topic": "Mensa & Gastronomie"
            }
        ]
        
        Fragen:
        ---
        ${questionsText}
        ---
    `;

    try {
        const result = await chatCompletion([
            { role: 'system', content: 'Du gruppierst ähnliche Fragen und antwortest ausschließlich mit JSON.' },
            { role: 'user', content: prompt }
        ], { temperature: 0.2, maxTokens: 2000 });

        const text = result.content?.trim();

        // Clean the response to ensure it's valid JSON
        let jsonString = (text || '').replace(/^```json\s*|```\s*$/g, '').trim();

        // Try to extract JSON if wrapped in other text
        const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            jsonString = jsonMatch[0];
        }

        let data;
        try {
            data = JSON.parse(jsonString);
        } catch (parseError) {
            // Try to fix common issues
            jsonString = jsonString.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
            data = JSON.parse(jsonString);
        }

        if (Array.isArray(data)) {
            console.log(`[QuestionGrouper] Successfully grouped ${questions.length} questions into ${data.length} groups.`);
            return data;
        }

        console.error("[QuestionGrouper] AI response was not an array or parsing failed:", text);
        return null;

    } catch (error) {
        console.error("[QuestionGrouper] Error during API call:", error.message);
        return null;
    }
}

function mergeSimilarGroups(groups) {
    // Simple merging logic based on normalized questions
    const merged = new Map();
    
    for (const group of groups) {
        const key = group.normalized_question.toLowerCase().trim();
        
        if (merged.has(key)) {
            const existing = merged.get(key);
            existing.original_questions.push(...group.original_questions);
            existing.question_count += group.question_count;
            
            // Merge languages
            const allLanguages = [...new Set([...existing.languages_detected, ...group.languages_detected])];
            existing.languages_detected = allLanguages;
        } else {
            merged.set(key, { ...group });
        }
    }
    
    return Array.from(merged.values())
        .sort((a, b) => b.question_count - a.question_count);
}

/**
 * Extract potential questions from message content
 * @param {Array<object>} messages - Messages from database
 * @returns {Array<string>} - Extracted questions
 */
function extractQuestions(messages) {
    return messages
        .filter(msg => msg.role === 'user' && msg.content)
        .map(msg => msg.content.trim())
        .filter(content => {
            // Basic question detection
            return (
                content.includes('?') || 
                content.toLowerCase().match(/^(wo|wie|was|wann|warum|welche|where|how|what|when|why|which|哪里|什么|如何|何时|为什么)/) ||
                content.toLowerCase().includes('kann ich') ||
                content.toLowerCase().includes('can i') ||
                content.toLowerCase().includes('how to') ||
                content.toLowerCase().includes('wie kann')
            );
        });
}

module.exports = { 
    groupSimilarQuestions, 
    extractQuestions 
};
