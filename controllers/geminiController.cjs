const { GoogleGenerativeAI } = require("@google/generative-ai");
const { HochschuhlABC, Questions } = require("./db.cjs");
const { getCached } = require("../utils/cache");
const { estimateTokens, isWithinTokenLimit } = require("../utils/tokenizer");
const { summarizeConversation } = require("../utils/summarizer");

// In-memory conversation store
const conversations = new Map();

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error(
    "Fehler: Kein API-Key gefunden. Bitte setze die Umgebungsvariable API_KEY."
  );
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function logUnansweredQuestion(newQuestion) {
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
  // console.log(`logUnansweredQuestion finished at: ${new Date().toISOString()}`);
}

async function generateResponse(req, res) {
  try {
    const { prompt, conversationId } = req.body;
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

    const historyText = messages.map(m => `${m.isUser ? "User" : "Assistant"}: ${m.text}`).join("\n");
    const fullTextForTokenCheck = `**Inhalt des Hochschul ABC (2025)**:\n${hochschulContent}\n\n**Gesprächsverlauf**:\n${historyText}\n\nBenutzerfrage: ${prompt}`;

    if (!isWithinTokenLimit(fullTextForTokenCheck, 6000)) {
      messages = await summarizeConversation(messages);
      conversations.set(convoId, messages);
      console.log(`Summarized conversation, new message count: ${messages.length}`);
    }

    const fullPrompt = `
      --system prompt--
      You are a customer support agent dedicated to answering questions, resolving issues, 
      and providing helpful solutions promptly. Maintain a friendly and professional tone in all interactions. 
      
      Ensure responses are concise, clear, and directly address the user's concerns. Try to answer to the point and be super helpful and positive.
      Escalate complex issues to human agents when necessary to ensure customer satisfaction.
    

      Contact data includes Name, Responsibility, Email, Phone number, Room, and talking hours. 
      Whenever you recommend a contact or advise to contact someone, provide complete contact data 
      for all relevant individuals, including: Name, Responsibility, Email, Phone number, Room, and talking hours. 
      
      If multiple persons are responsible, briefly explain the difference between them and provide full contact data for each.
      
      If there are diverging Answers for long and short term students, and the user did not yet specify their status, 
      ask for clarification and point out the difference.

      Answer in the language of the user prompt, or the language the user wishes.


      **Knowledgebase of the HTW Desden**:
      ${hochschulContent}

      --

      If you can not answer a question about the HTW Dresden from the Knowledgebase, 
      add the chars "<+>" at the end of the answer.

      --
      
      **Gesprächsverlauf**:
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

    const aiMessage = { text: fullResponseText, isUser: false, timestamp: new Date().toISOString() };
    messages.push(aiMessage);
    conversations.set(convoId, messages);
    console.log(`Saved AI response: ${fullResponseText.slice(0, 50)}...`);

    if (fullResponseText.includes("<+>")) {
      logUnansweredQuestion(prompt);
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

module.exports = { generateResponse };
