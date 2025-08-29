const { GoogleGenerativeAI } = require("@google/generative-ai");
const { HochschuhlABC, Questions, Images, Conversation, Message } = require("./db.cjs"); // Import new models from db.cjs
const { getCached } = require("../utils/cache");
const { estimateTokens, isWithinTokenLimit } = require("../utils/tokenizer");
const { summarizeConversation } = require("../utils/summarizer");
const { trackSession, trackChatInteraction, trackArticleView, extractArticleIds } = require("../utils/analytics");
const { categorizeConversation } = require("../utils/categorizer");

// In-memory conversation store is no longer needed
// const conversations = new Map();

const defaultApiKey = process.env.GEMINI_API_KEY;
if (!defaultApiKey) {
  console.error(
    "Fehler: Kein API-Key gefunden. Bitte setze die Umgebungsvariable GEMINI_API_KEY."
  );
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(defaultApiKey);

async function logUnansweredQuestion(newQuestion) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
    let currentGenAI = genAI;

    if (userApiKey) {
      console.log("Using user-provided API key.");
      currentGenAI = new GoogleGenerativeAI(userApiKey);
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

    const entries = await HochschuhlABC.findAll({
      where: { active: true, archived: null },
      order: [["headline", "DESC"]],
      attributes: ["headline", "text"],
    });
    const hochschulContent = entries.map(entry => `## ${entry.headline}\n\n${entry.text}\n\n`).join("");

    const images = await Images.findAll({
      attributes: ["filename", "description"],
    });
    const imageList = images.map(image => `image_name: ${image.filename} description: ${image.description ? image.description.replace(/\n/g, ' ') : ''}`).join("\n\n");

    const historyText = messages.map(m => `${m.isUser ? "User" : "Assistant"}: ${m.text}`).join("\n");
    const fullTextForTokenCheck = `**Inhalt des Hochschul ABC (2025)**:\n${hochschulContent}\n\n**Gesprächsverlauf**:\n${historyText}\n\nBenutzerfrage: ${prompt}`;

    if (!isWithinTokenLimit(fullTextForTokenCheck, 6000)) {
      messages = await summarizeConversation(messages);
      // The next two lines are removed as 'conversations' is no longer used
      // conversations.set(convoId, messages); 
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
      
      **Conversation History**:
      ${messages.map(m => `${m.isUser ? "User" : "Assistant"}: ${m.text}`).join("\n")} 
      
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

            const categorizationResult = await categorizeConversation(finalHistory);

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

module.exports = { streamChat, getSuggestions };

