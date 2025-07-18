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

    // Generate new conversationId if not provided
    const convoId =
      conversationId ||
      new Date().toISOString() + Math.random().toString(36).slice(2);
    console.log(`Processing conversationId: ${convoId}`);

    // Retrieve or create conversation
    let messages = conversations.get(convoId);
    if (!messages) {
      messages = [];
      conversations.set(convoId, messages);
      console.log(`Created new conversation: ${convoId}`);
    } else {
      console.log(
        `Found conversation: ${convoId}, messages: ${messages.length}`
      );
    }

    // Add user prompt to conversation
    const userMessage = {
      text: prompt,
      isUser: true,
      timestamp: new Date().toISOString(),
    };
    messages = [...messages, userMessage];
    conversations.set(convoId, messages);
    console.log(`Saved user message: ${prompt}`);

    // Fetch data from HochschuhlABC table
    const entries = await HochschuhlABC.findAll({
      where: {
        active: true,
        archived: null,
      },
      order: [["headline", "DESC"]],
      attributes: ["headline", "text"],
    });

    // Format database content
    const hochschulContent = entries
      .map((entry) => `## ${entry.headline}\n\n${entry.text}\n\n`)
      .join("");

    // Format conversation history for prompt
    const historyText = messages
      .map((m) => `${m.isUser ? "User" : "Assistant"}: ${m.text}`)
      .join("\n");

    // Check token limit and summarize if needed
    let messagesToUse = messages;
    const fullText = `
      **Inhalt des Hochschul ABC (2025)**:
      ${hochschulContent}
      
      **Gesprächsverlauf**:
      ${historyText}
      
      Benutzerfrage: ${prompt}
    `;
    if (!isWithinTokenLimit(fullText, 6000)) {
      messagesToUse = await summarizeConversation(messages);
      messages = messagesToUse;
      conversations.set(convoId, messages);
      console.log(
        `Summarized conversation, new message count: ${messagesToUse.length}`
      );
    }

    // Create the full prompt
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
      
      Answer in the language of the user prompt, or the language the user wishes.


      **Knowledgebase of the HTW Desden**:
      ${hochschulContent}

      --

      If you can not answer a question about the HTW Dresden from the Knowledgebase, 
      add the chars "<+>" at the end of the answer.

      --
      
      **Gesprächsverlauf**:
      ${messagesToUse
        .map((m) => `${m.isUser ? "User" : "Assistant"}: ${m.text}`)
        .join("\n")}
      
      --user prompt--
      ${prompt}
    `;

    // Generate response
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    // Add AI response to conversation
    const aiMessage = {
      text,
      isUser: false,
      timestamp: new Date().toISOString(),
    };
    messages = [...messages, aiMessage];
    conversations.set(convoId, messages);
    console.log(`Saved AI response: ${text.slice(0, 50)}...`);

    // Log unanswered questions
    if (
      text.includes(
        "<+>"
      )
    ) {
      logUnansweredQuestion(prompt);
    }

    // console.log(`answer finished at: ${new Date().toISOString()}`);

    res.json({ response: text, conversationId: convoId });
  } catch (error) {
    console.error("Fehler beim Generieren der Antwort:", error.message);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
}

module.exports = { generateResponse };
