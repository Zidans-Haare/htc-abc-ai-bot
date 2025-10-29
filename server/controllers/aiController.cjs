const { HochschuhlABC, Questions, Images, Conversation, Message } = require('./db.cjs');
const { getImageList } = require('../utils/imageProvider.js');
const { estimateTokens, isWithinTokenLimit } = require('../utils/tokenizer');
const { summarizeConversation } = require('../utils/summarizer');
const { trackSession, trackChatInteraction, trackArticleView, extractArticleIds } = require('../utils/analytics');
const { chatCompletion, chatCompletionStream } = require('../utils/aiProvider');
const vectorStore = require('../lib/vectorStore');

// Lazy import to avoid immediate API key check
let categorizeConversation = null;

function loadCategorizer() {
  if (!categorizeConversation) {
    const categorizer = require('../utils/categorizer');
    categorizeConversation = categorizer.categorizeConversation;
  }
  return categorizeConversation;
}

// Removed runChatCompletion, using chatCompletion directly

async function logUnansweredQuestion(newQuestion) {
  try {
    const unansweredQuestions = await Questions.findMany({
      where: { answered: false, spam: false, deleted: false },
      select: { question: true },
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

      const duplicateAnswer = (await chatCompletion([
        { role: 'system', content: 'You determine whether a new question is a duplicate of previous unanswered questions.' },
        { role: 'user', content: duplicatePrompt },
      ])).content.toLowerCase();
      if (duplicateAnswer === 'yes') {
        console.log(`Duplicate question not logged: "${newQuestion}"`);
        return;
      }
    }

    const translatePrompt = `Translate the following text to German. If it is already in German, answer with "no".\nText: "${newQuestion}"`;
    const translatedQuestion = (await chatCompletion([
      { role: 'system', content: 'You translate user inputs to German when they are not already in German.' },
      { role: 'user', content: translatePrompt },
    ])).content;

    let translationToStore = null;
    if (translatedQuestion.toLowerCase() !== 'no') {
      translationToStore = translatedQuestion;
    }

    await Questions.create({
      data: {
        question: newQuestion,
        translation: translationToStore,
        answered: false,
        archived: false,
        deleted: false,
        spam: false,
      },
    });
    console.log('Unanswered question logged to database');
  } catch (error) {
    console.error('Fehler beim Protokollieren der offenen Frage:', error.message);
  }
}

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Chat-Antwort vom AI-Backend abrufen
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: Die Nachricht des Benutzers
 *               conversationId:
 *                 type: string
 *                 description: Optionale Konversations-ID
 *               anonymousUserId:
 *                 type: string
 *                 description: Optionale anonyme Benutzer-ID
 *               timezoneOffset:
 *                 type: number
 *                 description: Zeitzonen-Offset in Minuten
 *     responses:
 *       200:
 *         description: JSON-Antwort mit generierter AI-Nachricht
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversationId:
 *                   type: string
 *                 response:
 *                   type: string
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     sent:
 *                       type: integer
 *                     received:
 *                       type: integer
 *       400:
 *         description: Fehlender Prompt
 *       500:
 *         description: Serverfehler
 */
async function streamChat(req, res) {
  const startTime = Date.now();
  let sessionId = null;

  try {
    const { prompt, conversationId, anonymousUserId, timezoneOffset } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt ist erforderlich' });
    }

    const userApiKey = req.headers['x-user-api-key'];

    // Track session
    sessionId = await trackSession(req);
    req.res = res;

    const convoId = conversationId || new Date().toISOString() + Math.random().toString(36).slice(2);
    console.log(`Processing conversationId: ${convoId}`);

    const conversation = await Conversation.upsert({
      where: { id: convoId },
      update: {},
      create: {
        id: convoId,
        anonymous_user_id: anonymousUserId || 'unknown',
        category: 'Unkategorisiert',
        ai_confidence: 0.0,
        created_at: new Date(),
      },
    });
    console.log(`Processed conversation in DB: ${convoId}`);

    await Message.create({
      data: {
        conversation_id: conversation.id,
        role: 'user',
        content: prompt,
        created_at: new Date(),
      },
    });
    console.log(`Saved user message to DB: ${prompt}`);

    const history = await Message.findMany({
      where: { conversation_id: conversation.id },
      orderBy: { created_at: 'asc' },
    });

    let messages = history.map(msg => ({
      text: msg.content,
      isUser: msg.role === 'user',
    }));

    let hochschulContent = '';
    if (vectorStore.store) {
      const relevantDocs = await vectorStore.similaritySearch(prompt);
      hochschulContent = relevantDocs.map(doc => doc.pageContent).join('\n\n');
      if (vectorStore.graphData) {
        const graphContext = await vectorStore.getGraphSummary(prompt, vectorStore.graphData);
        hochschulContent += `\nGraph Summary: ${graphContext}`;
      }
    } else {
      // Fallback to full DB if vector DB not enabled
      const entries = await HochschuhlABC.findMany({
        where: { active: true, archived: null },
        orderBy: { article: 'desc' },
        select: { article: true, description: true },
      });
      hochschulContent = entries.map(entry => `## ${entry.article}\n\n${entry.description}\n\n`).join('');
    }

    const imageList = await getImageList({
      mode: process.env.USE_VECTOR_IMAGES || 'static',
      query: prompt
    });

    const historyText = messages.map(m => `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
    const fullTextForTokenCheck = `**Inhalt des Hochschul ABC (2025)**:\n${hochschulContent}\n\n**Gesprächsverlauf**:\n${historyText}\n\nBenutzerfrage: ${prompt}`;

    if (!isWithinTokenLimit(fullTextForTokenCheck, 6000)) {
      messages = await summarizeConversation(messages);
      console.log(`Summarized conversation, new message count: ${messages.length}`);
    }

    const now = new Date();
    const dateAndTime = `Current date and time in Dresden, Germany is ${now.toLocaleString('en-GB', {
      timeZone: 'Europe/Berlin',
      dateStyle: 'full',
      timeStyle: 'long',
    })}`;

    let timezoneInfo = '';
    try {
      const germanOffsetString = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Berlin',
        timeZoneName: 'shortOffset',
      }).format(now);
      const gmtMatch = germanOffsetString.match(/GMT([+-]\d+)/);
      if (!gmtMatch) throw new Error('Could not parse German timezone offset.');

      const germanOffsetHours = parseInt(gmtMatch[1], 10);
      const germanOffsetMinutes = germanOffsetHours * 60;
      const userOffsetMinutes = -timezoneOffset;
      const offsetDifferenceHours = (userOffsetMinutes - germanOffsetMinutes) / 60;

      if (Math.abs(offsetDifferenceHours) > 0) {
        const direction = offsetDifferenceHours > 0 ? 'ahead of' : 'behind';
        timezoneInfo = `The user's timezone is ${Math.abs(offsetDifferenceHours)} hours ${direction} German time. When answering questions about time, state the time in the user's local time and mention the difference.`;
      }
    } catch (e) {
      console.error('Could not determine timezone offset:', e.message);
    }

    const systemPrompt = `
      --system prompt--
      You are a customer support agent dedicated to answering questions, resolving issues,
      and providing helpful solutions promptly. Maintain a friendly and professional tone in all interactions.

      Ensure responses are concise, clear, and directly address the user's concerns. Try to answer to the point and be super helpful and positive.
      Escalate complex issues to human agents when necessary to ensure customer satisfaction.

      ${dateAndTime}.
      ${timezoneInfo}

      Contact data includes Name, Responsibility, Email, Phone number, Room, and talking hours.
      Whenever you recommend a contact or advise to contact someone, provide complete contact data
      for all relevant individuals, including: Name, Responsibility, Email, Phone number, Room, and talking hours.

      If multiple persons are responsible, briefly explain the difference between them and provide full contact data for each.

      If there are diverging Answers for long and short term students, and the user did not yet specify their status,
      ask for clarification and point out the difference.


      **Knowledgebase of the HTW Desden**:
      ${hochschulContent}

      **Image List**:
      ${imageList}

      If an image is in the Image List, that helps to answer the user question, add the image link to the answer.
      format the url in markdown: "\n\n ![](/uploads/images/<image_name>) \n\n"



      --

      If you can not answer a question about the HTW Dresden from the Knowledgebase,
      add the chars "<+>" at the end of the answer.

      --
    `;

    // Log token count for system prompt
    const systemTokens = estimateTokens(systemPrompt);
    console.log(`System prompt tokens: ${systemTokens}, Image mode: ${process.env.USE_VECTOR_IMAGES || 'static'}`);

    const openAIHistory = messages.map(m => ({
      role: m.isUser ? 'user' : 'assistant',
      content: m.text,
    }));

    const messagesPayload = [
      { role: 'system', content: systemPrompt },
      ...openAIHistory,
      { role: 'user', content: prompt },
    ];

    let fullResponseText = '';

    if (process.env.AI_STREAMING === 'true') {
      const stream = chatCompletionStream(messagesPayload, { apiKey: userApiKey, temperature: 0.2 });

      for await (const chunk of stream) {
        fullResponseText += chunk.token;
      }
    } else {
      const response = await chatCompletion(messagesPayload, { apiKey: userApiKey, temperature: 0.2 });
      fullResponseText = response.content;
    }

    await Message.create({
      data: {
        conversation_id: convoId,
        role: 'model',
        content: fullResponseText,
        created_at: new Date(),
      },
    });
    console.log(`Saved AI response to DB: ${fullResponseText.slice(0, 50)}...`);

    const responseTime = Date.now() - startTime;
    const tokensUsed = estimateTokens(fullResponseText);
    let sentTokens = 0;
    if (process.env.DISPLAY_TOKEN_USED_FOR_QUERY === 'true') {
      const promptText = messagesPayload.map(m => m.content).join(' ');
      sentTokens = estimateTokens(promptText);
    }
    const wasSuccessful = !fullResponseText.includes('<+>');

    if (fullResponseText.includes('<+>')) {
      logUnansweredQuestion(prompt);
    }

    await trackChatInteraction(sessionId, prompt, fullResponseText, wasSuccessful, responseTime, tokensUsed);

    const referencedArticleIds = extractArticleIds(fullResponseText);
    for (const articleId of referencedArticleIds) {
      await trackArticleView(articleId, sessionId, prompt);
    }

    const responsePayload = {
      conversationId: convoId,
      response: fullResponseText,
    };

    if (process.env.DISPLAY_TOKEN_USED_FOR_QUERY === 'true') {
      responsePayload.tokens = { sent: sentTokens, received: tokensUsed };
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Error in streamChat:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

const backendTranslations = {
  de: {
    api_key_required: 'API-Schlüssel ist erforderlich.',
    api_key_valid: 'API-Schlüssel ist gültig.',
    unknown_error: 'Ein unbekannter Fehler ist bei der Validierung aufgetreten.',
    invalid_api_key: 'Der API-Schlüssel ist ungültig. Bitte überprüfen Sie Ihren Schlüssel und versuchen Sie es erneut.',
    quota_exceeded: 'API-Kontingent überschritten. Bitte versuchen Sie es später erneut.',
    network_error: 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.',
  },
  en: {
    api_key_required: 'API key is required.',
    api_key_valid: 'API key is valid.',
    unknown_error: 'An unknown error occurred during validation.',
    invalid_api_key: 'The API key is invalid. Please check your key and try again.',
    quota_exceeded: 'API quota exceeded. Please try again later.',
    network_error: 'Network error. Please check your internet connection and try again.',
  },
};

/**
 * @swagger
 * /api/test-api-key:
 *   post:
 *     summary: API-Schlüssel für Google AI testen
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiKey
 *             properties:
 *               apiKey:
 *                 type: string
 *                 description: Der zu testende API-Schlüssel
 *               language:
 *                 type: string
 *                 enum: [de, en]
 *                 default: de
 *                 description: Sprache für Fehlermeldungen
 *     responses:
 *       200:
 *         description: API-Schlüssel ist gültig
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: API-Schlüssel fehlt oder ungültig
 *       500:
 *         description: Serverfehler
 */
async function testApiKey(req, res) {
  const { apiKey, language = 'de' } = req.body;
  const trans = backendTranslations[language] || backendTranslations.de;

  if (!apiKey) {
    return res.status(400).json({ message: trans.api_key_required });
  }

  try {
    await chatCompletion([
      { role: 'system', content: 'You are a key validation assistant.' },
      { role: 'user', content: 'hello' },
    ], { apiKey, maxTokens: 5, temperature: 0 });

    res.status(200).json({ message: trans.api_key_valid });
  } catch (error) {
    console.error('API-Schlüssel-Validierungsfehler:', error);

    let clientMessage = trans.unknown_error;
    let statusCode = 500;

    const errorType = error?.error?.type || error?.type || '';
    const errorMessage = (error?.error?.message || error?.message || '').toLowerCase();

    if (errorType === 'invalid_api_key' || errorMessage.includes('invalid api key')) {
      clientMessage = trans.invalid_api_key;
      statusCode = 400;
    } else if (errorType === 'insufficient_quota' || errorMessage.includes('insufficient_quota') || errorMessage.includes('quota')) {
      clientMessage = trans.quota_exceeded;
      statusCode = 429;
    } else if (errorType === 'rate_limit_exceeded' || errorMessage.includes('rate limit')) {
      clientMessage = trans.quota_exceeded;
      statusCode = 429;
    } else if (errorType === 'api_connection_error' || errorMessage.includes('network') || errorMessage.includes('timeout')) {
      clientMessage = trans.network_error;
      statusCode = 503;
    }

    res.status(statusCode).json({ message: clientMessage });
  }
}

/**
 * @swagger
 * /api/suggestions:
 *   get:
 *     summary: Chat-Vorschläge abrufen
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: Liste der Vorschläge
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       500:
 *         description: Serverfehler
 */
async function getSuggestions(req, res) {
  try {
    const suggestions = await HochschuhlABC.findMany({
      where: { active: true, archived: null },
      select: { article: true, description: true },
      orderBy: { article: 'asc' },
      take: 10,
    });

    const formattedSuggestions = suggestions.map(s => ({
      article: s.article,
      description: s.description.substring(0, 100) + (s.description.length > 100 ? '...' : ''),
    }));

    res.json(formattedSuggestions);
  } catch (error) {
    console.error('Fehler beim Abrufen der Vorschläge:', error.message);
    res.status(500).json({ error: 'Vorschläge konnten nicht geladen werden' });
  }
}

module.exports = { streamChat, getSuggestions, testApiKey };
