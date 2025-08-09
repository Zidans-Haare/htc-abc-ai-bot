const { GoogleGenerativeAI } = require("@google/generative-ai");
const { HochschuhlABC, Questions, Images } = require("./db.cjs");
const { Op } = require('sequelize');
const { getCached } = require("../utils/cache");
const { estimateTokens, isWithinTokenLimit } = require("../utils/tokenizer");
const { summarizeConversation } = require("../utils/summarizer");

// In-memory conversation store
const conversations = new Map();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    "Fehler: Kein API-Key gefunden. Bitte setze die Umgebungsvariable GEMINI_API_KEY."
  );
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function logUnansweredQuestion(newQuestion, conversationId) {
  try {

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
      
    console.log(`Logging unanswered question with conversationId: ${conversationId}`);
    await Questions.create({
      question: newQuestion,
      translation: translationToStore,
      answered: false,
      archived: false,
      deleted: false,
      spam: false,
      conversationId: conversationId
    });
    console.log(`Unanswered question logged to database`);
  } catch (error) {
    console.error(
      "Fehler beim Protokollieren der offenen Frage:",
      error.message
    );
  }
  // console.log(`logUnansweredQuestion finished at: ${new Date().toISOString()}`);
}

async function logUserQuestion(prompt, convoId) {
  try {
    await Questions.create({
      question: prompt,
      conversationId: convoId,
      answered: false, // Default to false, update later if answered
      archived: false,
      deleted: false,
      spam: false,
    });
    console.log(`User question logged to database with conversationId: ${convoId}`);
  } catch (error) {
    console.error("Error logging user question:", error.message);
  }
}

async function generateResponse(req, res) {
  try {
    const { prompt, conversationId, timezoneOffset } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt ist erforderlich" });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush the headers to establish the connection

    const convoId = conversationId || new Date().toISOString() + Math.random().toString(36).slice(2);
    console.log(`Processing conversationId: ${convoId}`);

    // Log the user's question immediately
    await logUserQuestion(prompt, convoId);

    let messages = conversations.get(convoId) || [];
    if (messages.length === 0) {
      conversations.set(convoId, messages);
      console.log(`Created new conversation: ${convoId}`);
    }

    const userMessage = { text: prompt, isUser: true, timestamp: new Date().toISOString() };
    messages.push(userMessage);
    console.log(`Saved user message: ${prompt}`);

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
      conversations.set(convoId, messages);
      console.log(`Summarized conversation, new message count: ${messages.length}`);
    }

    const now = new Date();
    const dateAndTime = `Current date and time in Dresden, Germany is ${now.toLocaleString('en-GB', { timeZone: 'Europe/Berlin', dateStyle: 'full', timeStyle: 'long' })}`;
    
    let timezoneInfo = '';
    try {
        // Get German offset in minutes from UTC
        const germanOffsetString = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' }).format(now);
        const gmtMatch = germanOffsetString.match(/GMT([+-]\d+)/);
        if (!gmtMatch) throw new Error("Could not parse German timezone offset.");
        
        const germanOffsetHours = parseInt(gmtMatch[1], 10);
        const germanOffsetMinutes = germanOffsetHours * 60;

        // Get user offset in minutes from UTC (it's inverted from the client)
        const userOffsetMinutes = -timezoneOffset;

        const offsetDifferenceHours = (userOffsetMinutes - germanOffsetMinutes) / 60;

        if (Math.abs(offsetDifferenceHours) > 0) {
            const direction = offsetDifferenceHours > 0 ? 'ahead of' : 'behind';
            timezoneInfo = `The user's timezone is ${Math.abs(offsetDifferenceHours)} hours ${direction} German time. When answering questions about time, state the time in the user's local time and mention the difference.`;
        }
    } catch (e) {
        console.error("Could not determine timezone offset:", e.message);
        // Silently fail, timezoneInfo will be empty
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

      --used articles--
      After the response, add a line that says "USED_ARTICLES:" followed by a comma-separated list of the headlines of the articles you used to generate the response.
    `;

    const result = await model.generateContentStream(fullPrompt);
    
    let fullResponseText = '';
    let usedArticlesEncountered = false;
    for await (const chunk of result.stream) {
      if (usedArticlesEncountered) {
        fullResponseText += chunk.text();
        continue;
      }
      const chunkText = chunk.text();
      const usedArticlesIndex = chunkText.indexOf('USED_ARTICLES:');
      if (usedArticlesIndex !== -1) {
        const textToSend = chunkText.substring(0, usedArticlesIndex);
        if (textToSend.length > 0) {
          res.write(`data: ${JSON.stringify({ token: textToSend, conversationId: convoId })}\n\n`);
        }
        fullResponseText += chunkText;
        usedArticlesEncountered = true;
        res.write('data: [DONE]\n\n'); // End the stream for the client
        res.end();
        return; // Stop processing further chunks for the client
      }
      fullResponseText += chunkText;
      res.write(`data: ${JSON.stringify({ token: chunkText, conversationId: convoId })}\n\n`);
    }

    // If the stream ended without USED_ARTICLES, send DONE
    if (!usedArticlesEncountered) {
      res.write('data: [DONE]\n\n');
      res.end();
    }

    // Remove USED_ARTICLES from the response before saving it to the conversation history
    const usedArticlesIndex = fullResponseText.indexOf('USED_ARTICLES:');
    const cleanedResponseText = usedArticlesIndex !== -1 ? fullResponseText.substring(0, usedArticlesIndex).trim() : fullResponseText;

    const aiMessage = { text: cleanedResponseText, isUser: false, timestamp: new Date().toISOString() };
    messages.push(aiMessage);
    conversations.set(convoId, messages);
    console.log(`Saved AI response: ${cleanedResponseText.slice(0, 50)}...`);

    if (fullResponseText.includes("<+>")) {
      logUnansweredQuestion(prompt, convoId);
    } else {
      // If the question was answered, update the corresponding entry in Questions table
      await Questions.update(
        { answered: true },
        { where: { question: prompt, conversationId: convoId } }
      );
      console.log(`Question marked as answered for conversationId: ${convoId}`);
    }

    // Update view count
    if (usedArticlesIndex !== -1) {
        const usedArticlesStr = fullResponseText.substring(usedArticlesIndex + 'USED_ARTICLES:'.length).trim();
        const usedArticles = usedArticlesStr.split(',').map(h => h.trim());
        
        if (usedArticles.length > 0) {
            await HochschuhlABC.increment('views', { where: { headline: { [Op.in]: usedArticles } } });
        }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error("Fehler beim Generieren der Antwort:", error.message);
    // Ensure the connection is closed properly in case of an error
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

module.exports = { generateResponse, getSuggestions };
