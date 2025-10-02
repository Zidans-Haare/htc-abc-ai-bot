const { GoogleGenerativeAI } = require("@google/generative-ai");
const { HochschuhlABC, Questions, Images, Conversation, Message } = require("./db.cjs"); // Import new models from db.cjs
const { estimateTokens, isWithinTokenLimit } = require("../utils/tokenizer");
const { summarizeConversation } = require("../utils/summarizer");
const { trackSession, trackChatInteraction, trackArticleView, extractArticleIds } = require("../utils/analytics");
const { retrieveRelevantChunks } = require("../utils/retriever");
// Lazy import to avoid immediate API key check
let categorizeConversation = null;

function loadCategorizer() {
    if (!categorizeConversation) {
        const categorizer = require("../utils/categorizer");
        categorizeConversation = categorizer.categorizeConversation;
    }
    return categorizeConversation;
}

function stripHeadingMarkers(chunkText) {
    if (!chunkText) return '';
    return chunkText
        .replace(/\r\n?/g, '\n')
        .replace(/^#\s+[^\n]*\n?/, '')
        .trim();
}

function formatKnowledgeChunksForPrompt(chunks) {
    if (!chunks || !chunks.length) {
        return 'Keine passenden Wissensbausteine gefunden. Antworte trotzdem höflich, erkläre die Lage und füge "<+>" an, falls die Frage unbeantwortet bleibt.';
    }

    return chunks.map((chunk, index) => {
        const sectionLabel = chunk.section_heading ? `Abschnitt: ${chunk.section_heading}` : 'Abschnitt: Allgemein';
        const scoreLabel = typeof chunk.score === 'number' ? `Relevanzscore: ${chunk.score.toFixed(2)}` : 'Relevanzscore: n/a';
        const body = stripHeadingMarkers(chunk.chunk_text);
        return `[#${index + 1}] Artikel ${chunk.article_id} – ${chunk.headline}\n${sectionLabel} | Chunk ${chunk.chunk_index} | ${scoreLabel}\n${body}`;
    }).join('\n\n---\n\n');
}

// In-memory conversation store is no longer needed
// const conversations = new Map();

// Lazy initialization - only check API key when actually needed
let genAI = null;

function initializeGemini() {
    const defaultApiKey = process.env.GEMINI_API_KEY;
    if (!defaultApiKey) {
        throw new Error("GEMINI_API_KEY environment variable not set.");
    }
    if (!genAI) {
        genAI = new GoogleGenerativeAI(defaultApiKey);
    }
    return genAI;
}

async function logUnansweredQuestion(newQuestion) {
  try {
    const currentGenAI = initializeGemini();
    const model = currentGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const unansweredQuestions = await Questions.findAll({
      where: { answered: false, spam: false, deleted: false },
      attributes: ['question'],
    });

    if (unansweredQuestions.length > 0) {
      const questionList = unansweredQuestions.map(q => q.question).join('\n - ');
      const duplicatePrompt = `
        Here is a list of unanswered questions:
        - ${questionList}

        Is the following new question a duplicate of any in the list above?
        New question: "${newQuestion}"

        Answer with only "yes" or "no".
      `;
      let result = await model.generateContent(duplicatePrompt);
      let response = await result.response;
      const text = response.text().trim().toLowerCase();

      if (text === 'yes') {
        console.log(`Duplicate question not logged: "${newQuestion}"`);
        return;
      }
    }

    // Translate the question to German
    const translatePrompt = `Translate the following text to German. If it is already in German, answer with "no".
    Text: "${newQuestion}"`;
    result = await model.generateContent(translatePrompt);
    response = await result.response;
    let translatedQuestion = response.text().trim();

    let translationToStore = null;

    if (translatedQuestion.toLowerCase() !== 'no') {
      translationToStore = translatedQuestion;
    }
      
    await Questions.create({
      question: newQuestion,
      translation: translationToStore,
      answered: false,
      archived: false,
      deleted: false,
      spam: false,
    });
    console.log(`Unanswered question logged to database`);
  } catch (error) {
    console.error(
      "Fehler beim Protokollieren der offenen Frage:",
      error.message
    );
  }
}

async function streamChat(req, res) {
  const startTime = Date.now();
  let sessionId = null;
  
  try {
    const { prompt, conversationId, anonymousUserId, timezoneOffset } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt ist erforderlich" });
    }

    const userApiKey = req.headers['x-user-api-key'];
    let currentGenAI;

    if (userApiKey) {
      console.log("Using user-provided API key.");
      currentGenAI = new GoogleGenerativeAI(userApiKey);
    } else {
      currentGenAI = initializeGemini();
    }
    const model = currentGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Track session
    sessionId = await trackSession(req);
    req.res = res; // Make res available for cookie setting

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const convoId = conversationId || new Date().toISOString() + Math.random().toString(36).slice(2);
    console.log(`Processing conversationId: ${convoId}`);

    // --- Database-backed conversation history ---
    const [conversation, created] = await Conversation.findOrCreate({
      where: { id: convoId },
      defaults: { 
        anonymous_user_id: anonymousUserId || 'unknown',
        category: 'Unkategorisiert',
        ai_confidence: 0.0
      }
    });
    if (created) {
      console.log(`Created new conversation in DB: ${convoId}`);
    }

    await Message.create({
      conversation_id: conversation.id,
      role: 'user',
      content: prompt
    });
    console.log(`Saved user message to DB: ${prompt}`);

    // Fetch history from DB
    const history = await Message.findAll({
      where: { conversation_id: conversation.id },
      order: [['created_at', 'ASC']]
    });

    // Map DB messages to the format expected by the rest of the function
    let messages = history.map(msg => ({
      text: msg.content,
      isUser: msg.role === 'user'
    }));
    // --- End of new DB logic ---

    const retrievalStart = Date.now();
    const { chunks: knowledgeChunks, diagnostics: retrievalDiagnostics } = await retrieveRelevantChunks({
      prompt,
      conversationMessages: messages,
      limit: 8
    });
    console.log(`[Retriever] Query=${retrievalDiagnostics.matchQuery || 'fallback'} results=${knowledgeChunks.length} fallback=${retrievalDiagnostics.fallback} duration=${Date.now() - retrievalStart}ms`);

    const knowledgeContext = formatKnowledgeChunksForPrompt(knowledgeChunks);
    console.log(`[Retriever] Approx context tokens=${estimateTokens(knowledgeContext)}`);

    const images = await Images.findAll({
      attributes: ["filename", "description"],
    });
    const imageList = images.map(image => `image_name: ${image.filename} description: ${image.description ? image.description.replace(/\n/g, ' ') : ''}`).join("\n\n");

    let historyText = messages.map(m => `${m.isUser ? "User" : "Assistant"}: ${m.text}`).join("\n");
    let fullTextForTokenCheck = `**Relevante Wissensbausteine**:\n${knowledgeContext}\n\n**Gesprächsverlauf**:\n${historyText}\n\nBenutzerfrage: ${prompt}`;

    if (!isWithinTokenLimit(fullTextForTokenCheck, 6000)) {
      messages = await summarizeConversation(messages);
      historyText = messages.map(m => `${m.isUser ? "User" : "Assistant"}: ${m.text}`).join("\n");
      fullTextForTokenCheck = `**Relevante Wissensbausteine**:\n${knowledgeContext}\n\n**Gesprächsverlauf**:\n${historyText}\n\nBenutzerfrage: ${prompt}`;
      console.log(`Summarized conversation, new message count: ${messages.length}`);
    }

    const now = new Date();
    const dateAndTime = `Current date and time in Dresden, Germany is ${now.toLocaleString('en-GB', { timeZone: 'Europe/Berlin', dateStyle: 'full', timeStyle: 'long' })}`;
    
    let timezoneInfo = '';
    try {
        const germanOffsetString = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' }).format(now);
        const gmtMatch = germanOffsetString.match(/GMT([+-]\d+)/);
        if (!gmtMatch) throw new Error("Could not parse German timezone offset.");
        
        const germanOffsetHours = parseInt(gmtMatch[1], 10);
        const germanOffsetMinutes = germanOffsetHours * 60;

        const userOffsetMinutes = -timezoneOffset;

        const offsetDifferenceHours = (userOffsetMinutes - germanOffsetMinutes) / 60;

        if (Math.abs(offsetDifferenceHours) > 0) {
            const direction = offsetDifferenceHours > 0 ? 'ahead of' : 'behind';
            timezoneInfo = `The user's timezone is ${Math.abs(offsetDifferenceHours)} hours ${direction} German time. When answering questions about time, state the time in the user's local time and mention the difference.`;
        }
    } catch (e) {
        console.error("Could not determine timezone offset:", e.message);
    }
    const fullPrompt = `
      --system prompt--
      You are a customer support agent dedicated to answering questions, resolving issues, 
      and providing helpful solutions promptly. Maintain a friendly and professional tone in all interactions. 
      
      Ensure responses are concise, clear, and directly address the user's concerns. Try to answer to the point and be super helpful and positive.
      Escalate complex issues to human agents when necessary to ensure customer satisfaction.
    
      ${dateAndTime}.
      ${timezoneInfo}

      Arbeitsweise:
      - Nutze ausschließlich die unter **Relevante Wissensbausteine** bereitgestellten Inhalte für faktenbasierte Aussagen.
      - Verwende im Fließtext nummerierte Referenzen im Format "[1]", "[2]", ... für jede genutzte Quelle.
      - Sammle die tatsächlich genutzten Quellen am Ende unter der Überschrift "## Quellen" als nummerierte Liste, z.B. "1. Artikel <id>: <headline>". Hinterlege dabei keine Schritt-für-Schritt-Erklärung, sondern nur die Quellenangabe.
      - Wenn keine relevanten Quellen vorhanden sind, erkläre dies höflich, frage nach weiteren Details und füge "<+>" am Ende deiner Antwort an. Ergänze dann im Quellen-Abschnitt den Eintrag "- Keine passenden Einträge".

      Contact data includes Name, Responsibility, Email, Phone number, Room, and talking hours. 
      Whenever you recommend a contact or advise to contact someone, provide complete contact data 
      for all relevant individuals, including: Name, Responsibility, Email, Phone number, Room, and talking hours. 
      
      If multiple persons are responsible, briefly explain the difference between them and provide full contact data for each.
      
      If there are diverging answers for long and short term students, and the user did not yet specify their status, 
      ask for clarification and point out the difference.

      IMPORTANT: You MUST answer in the same language as the user's prompt. If the user asks in English, you MUST reply in English. If the user asks in German, you MUST reply in German.


      **Relevante Wissensbausteine**:
      ${knowledgeContext}

      **Image List**:
      ${imageList}

      If an image in the Image List helps to answer the question, add the markdown image link pattern "\n\n ![](/uploads/<image_name>) \n\n" to your response.




      --

      If you can not answer a question about the HTW Dresden from the knowledgebase above, 
      add the chars "<+>" at the end of the answer.

      --
      
      **Conversation History**:
      ${historyText} 
      
      --user prompt--
      ${prompt}
    `;

    const result = await model.generateContentStream(fullPrompt);
    
    let fullResponseText = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponseText += chunkText;
      res.write(`data: ${JSON.stringify({ token: chunkText, conversationId: convoId })}\n\n`);
    }

    // --- Save AI response to DB ---
    await Message.create({
      conversation_id: convoId,
      role: 'model',
      content: fullResponseText
    });
    console.log(`Saved AI response to DB: ${fullResponseText.slice(0, 50)}...`);
    // --- End of new DB logic ---

    const responseTime = Date.now() - startTime;
    const tokensUsed = estimateTokens(fullResponseText);
    const wasSuccessful = !fullResponseText.includes("<+>");

    if (fullResponseText.includes("<+>")) {
      logUnansweredQuestion(prompt);
    }

    await trackChatInteraction(sessionId, prompt, fullResponseText, wasSuccessful, responseTime, tokensUsed);

    const referencedArticleIds = extractArticleIds(fullResponseText);
    for (const articleId of referencedArticleIds) {
      await trackArticleView(articleId, sessionId, prompt);
    }

    res.write('data: [DONE]\n\n');
    res.end();

    // --- Start categorization in the background (fire and forget) ---
    // We do this after the response has been fully sent to the user.
    (async () => {
        try {
            const finalHistory = await Message.findAll({
                where: { conversation_id: convoId },
                order: [['created_at', 'ASC']],
                attributes: ['role', 'content']
            });

            const categorizationFunc = loadCategorizer();
            const categorizationResult = await categorizationFunc(finalHistory);

            if (categorizationResult) {
                await Conversation.update(
                    {
                        category: categorizationResult.category,
                        ai_confidence: categorizationResult.confidence
                    },
                    { where: { id: convoId } }
                );
            }
        } catch (e) {
            console.error(`[Categorizer] Background task failed for conversation ${convoId}:`, e.message);
        }
    })();
    // --- End of categorization ---

  } catch (error) {
    console.error("Fehler beim Generieren der Antwort:", error.message);
    
    const responseTime = Date.now() - startTime;
    await trackChatInteraction(sessionId, req.body.prompt || 'unknown', null, false, responseTime, 0, error.message);
    
    if (!res.headersSent) {
      res.status(500).json({ error: "Interner Serverfehler" });
    } else {
      res.end();
    }
  }
}

const { Sequelize } = require('sequelize');

async function getSuggestions(req, res) {
  try {
    const suggestions = await HochschuhlABC.findAll({
      where: { active: true, archived: null },
      order: Sequelize.literal('RANDOM()'),
      limit: 4,
      attributes: ['headline', 'text'],
    });

    const formattedSuggestions = suggestions.map(s => ({
      headline: s.headline,
      text: s.text.substring(0, 100) + (s.text.length > 100 ? '...' : ''),
    }));

    res.json(formattedSuggestions);
  } catch (error) {
    console.error("Fehler beim Abrufen der Vorschläge:", error.message);
    res.status(500).json({ error: "Vorschläge konnten nicht geladen werden" });
  }
}

// Backend translations for API key validation
const backendTranslations = {
  de: {
    api_key_required: 'API-Schlüssel ist erforderlich.',
    api_key_valid: 'API-Schlüssel ist gültig.',
    unknown_error: 'Ein unbekannter Fehler ist bei der Validierung aufgetreten.',
    invalid_api_key: 'Der API-Schlüssel ist ungültig. Bitte überprüfen Sie Ihren Schlüssel und versuchen Sie es erneut.',
    quota_exceeded: 'API-Kontingent überschritten. Bitte versuchen Sie es später erneut.',
    network_error: 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.'
  },
  en: {
    api_key_required: 'API key is required.',
    api_key_valid: 'API key is valid.',
    unknown_error: 'An unknown error occurred during validation.',
    invalid_api_key: 'The API key is invalid. Please check your key and try again.',
    quota_exceeded: 'API quota exceeded. Please try again later.',
    network_error: 'Network error. Please check your internet connection and try again.'
  }
};

async function testApiKey(req, res) {
  const { apiKey, language = 'de' } = req.body;
  const trans = backendTranslations[language] || backendTranslations.de;

  if (!apiKey) {
    return res.status(400).json({ message: trans.api_key_required });
  }

  try {
    const userGenAI = new GoogleGenerativeAI(apiKey);
    const model = userGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    await model.generateContent("hello");

    res.status(200).json({ message: trans.api_key_valid });
  } catch (error) {
    console.error("API-Schlüssel-Validierungsfehler:", error);

    let clientMessage = trans.unknown_error;
    let statusCode = 500;

    if (error.message) {
      // Check for various API key related errors
      if (error.message.toLowerCase().includes('api key not valid') ||
          error.message.toLowerCase().includes('api_key_invalid') ||
          error.message.toLowerCase().includes('invalid api key')) {
        clientMessage = trans.invalid_api_key;
        statusCode = 400;
      } else if (error.message.toLowerCase().includes('quota exceeded') ||
                 error.message.toLowerCase().includes('rate limit')) {
        clientMessage = trans.quota_exceeded;
        statusCode = 429;
      } else if (error.message.toLowerCase().includes('network') ||
                 error.message.toLowerCase().includes('timeout')) {
        clientMessage = trans.network_error;
        statusCode = 503;
      }
    }

    res.status(statusCode).json({ message: clientMessage });
  }
}

module.exports = { streamChat, getSuggestions, testApiKey };
