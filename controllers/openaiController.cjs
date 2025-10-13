const { HochschuhlABC, Questions, Images, Conversation, Message } = require('./db.cjs');
const { estimateTokens, isWithinTokenLimit } = require('../utils/tokenizer');
const { summarizeConversation } = require('../utils/summarizer');
const { trackSession, trackChatInteraction, trackArticleView, extractArticleIds } = require('../utils/analytics');
const { getOpenAIClient, DEFAULT_MODEL } = require('../utils/openaiClient');
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

function getChoiceText(response) {
  return response?.choices?.[0]?.message?.content?.trim() || '';
}

async function runChatCompletion(client, messages, options = {}) {
  const response = await client.chat.completions.create({
    model: options.model || DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens,
  });
  return getChoiceText(response);
}

async function logUnansweredQuestion(newQuestion) {
  try {
    const client = getOpenAIClient();

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

      const duplicateAnswer = (await runChatCompletion(client, [
        { role: 'system', content: 'You determine whether a new question is a duplicate of previous unanswered questions.' },
        { role: 'user', content: duplicatePrompt },
      ])).toLowerCase();
      if (duplicateAnswer === 'yes') {
        console.log(`Duplicate question not logged: "${newQuestion}"`);
        return;
      }
    }

    const translatePrompt = `Translate the following text to German. If it is already in German, answer with "no".\nText: "${newQuestion}"`;
    const translatedQuestion = await runChatCompletion(client, [
      { role: 'system', content: 'You translate user inputs to German when they are not already in German.' },
      { role: 'user', content: translatePrompt },
    ]);

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
    console.log('Unanswered question logged to database');
  } catch (error) {
    console.error('Fehler beim Protokollieren der offenen Frage:', error.message);
  }
}

async function streamChat(req, res) {
  const startTime = Date.now();
  let sessionId = null;

  try {
    const { prompt, conversationId, anonymousUserId, timezoneOffset } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt ist erforderlich' });
    }

    const userApiKey = req.headers['x-user-api-key'];
    const client = getOpenAIClient(userApiKey || null);

    // Track session
    sessionId = await trackSession(req);
    req.res = res;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const convoId = conversationId || new Date().toISOString() + Math.random().toString(36).slice(2);
    console.log(`Processing conversationId: ${convoId}`);

    const [conversation, created] = await Conversation.findOrCreate({
      where: { id: convoId },
      defaults: {
        anonymous_user_id: anonymousUserId || 'unknown',
        category: 'Unkategorisiert',
        ai_confidence: 0.0,
      },
    });
    if (created) {
      console.log(`Created new conversation in DB: ${convoId}`);
    }

    await Message.create({
      conversation_id: conversation.id,
      role: 'user',
      content: prompt,
    });
    console.log(`Saved user message to DB: ${prompt}`);

    const history = await Message.findAll({
      where: { conversation_id: conversation.id },
      order: [['created_at', 'ASC']],
    });

    let messages = history.map(msg => ({
      text: msg.content,
      isUser: msg.role === 'user',
    }));

    let hochschulContent = '';
    if (vectorStore.store) {
      const relevantDocs = await vectorStore.similaritySearch(prompt);
      hochschulContent = relevantDocs.map(doc => doc.pageContent).join('\n\n');
    } else {
      // Fallback to full DB if vector DB not enabled
      const entries = await HochschuhlABC.findAll({
        where: { active: true, archived: null },
        order: [['headline', 'DESC']],
        attributes: ['headline', 'text'],
      });
      hochschulContent = entries.map(entry => `## ${entry.headline}\n\n${entry.text}\n\n`).join('');
    }

    const images = await Images.findAll({
      attributes: ['filename', 'description'],
    });
    const imageList = images
      .map(image => `image_name: ${image.filename} description: ${image.description ? image.description.replace(/\n/g, ' ') : ''}`)
      .join('\n\n');

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

      IMPORTANT: You MUST answer in the same language as the user's prompt. If the user asks in English, you MUST reply in English. If the user asks in German, you MUST reply in German.


      **Knowledgebase of the HTW Desden**:
      ${hochschulContent}

      **Image List**:
      ${imageList}

      If and image is in the Image List, that helps to answer the user question, add the image link to the answer.
      format the url in markdown: "\n\n ![](/uploads/<image_name>) \n\n"



      --

      If you can not answer a question about the HTW Dresden from the Knowledgebase,
      add the chars "<+>" at the end of the answer.

      --
    `;

    const openAIHistory = messages.map(m => ({
      role: m.isUser ? 'user' : 'assistant',
      content: m.text,
    }));

    const messagesPayload = [
      { role: 'system', content: systemPrompt },
      ...openAIHistory,
      { role: 'user', content: prompt },
    ];

    const stream = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: messagesPayload,
      stream: true,
      temperature: 0.2,
    });

    let fullResponseText = '';

    for await (const chunk of stream) {
      const choice = chunk?.choices?.[0];
      if (!choice) continue;

      if (choice.delta?.content) {
        fullResponseText += choice.delta.content;
        res.write(`data: ${JSON.stringify({ token: choice.delta.content, conversationId: convoId })}\n\n`);
      }

      if (choice.finish_reason) {
        break;
      }
    }

    await Message.create({
      conversation_id: convoId,
      role: 'model',
      content: fullResponseText,
    });
    console.log(`Saved AI response to DB: ${fullResponseText.slice(0, 50)}...`);

    const responseTime = Date.now() - startTime;
    const tokensUsed = estimateTokens(fullResponseText);
    const wasSuccessful = !fullResponseText.includes('<+>');

    if (fullResponseText.includes('<+>')) {
      logUnansweredQuestion(prompt);
    }

    await trackChatInteraction(sessionId, prompt, fullResponseText, wasSuccessful, responseTime, tokensUsed);

    const referencedArticleIds = extractArticleIds(fullResponseText);
    for (const articleId of referencedArticleIds) {
      await trackArticleView(articleId, sessionId, prompt);
    }

    res.write('data: [DONE]\n\n');
    res.end();

    (async () => {
      try {
        const finalHistory = await Message.findAll({
          where: { conversation_id: convoId },
          order: [['created_at', 'ASC']],
          attributes: ['role', 'content'],
        });

        const categorizationFunc = loadCategorizer();
        const categorizationResult = await categorizationFunc(finalHistory);

        if (categorizationResult) {
          await Conversation.update(
            {
              category: categorizationResult.category,
              ai_confidence: categorizationResult.confidence,
            },
            { where: { id: convoId } },
          );
        }
      } catch (e) {
        console.error(`[Categorizer] Background task failed for conversation ${convoId}:`, e.message);
      }
    })();
  } catch (error) {
    console.error('Fehler beim Generieren der Antwort:', error.message);
    if (error?.status === 401 || error?.statusCode === 401) {
      console.error('OpenAI authentication failed. Check API key or base URL.');
    }

    const responseTime = Date.now() - startTime;
    await trackChatInteraction(sessionId, req.body.prompt || 'unknown', null, false, responseTime, 0, error.message);

    if (!res.headersSent) {
      if (error?.status === 401 || error?.statusCode === 401) {
        res.status(401).json({ error: 'KI-Zugriff verweigert. Bitte API-Schlüssel bzw. Service-Zugang prüfen.' });
      } else {
        res.status(500).json({ error: 'Interner Serverfehler' });
      }
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
    console.error('Fehler beim Abrufen der Vorschläge:', error.message);
    res.status(500).json({ error: 'Vorschläge konnten nicht geladen werden' });
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

async function testApiKey(req, res) {
  const { apiKey, language = 'de' } = req.body;
  const trans = backendTranslations[language] || backendTranslations.de;

  if (!apiKey) {
    return res.status(400).json({ message: trans.api_key_required });
  }

  try {
    const client = getOpenAIClient(apiKey);
    await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are a key validation assistant.' },
        { role: 'user', content: 'hello' },
      ],
      max_tokens: 5,
      temperature: 0,
    });

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

module.exports = { streamChat, getSuggestions, testApiKey };
