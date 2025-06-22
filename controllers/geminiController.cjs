const { Sequelize, DataTypes } = require('sequelize');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getCached } = require('../utils/cache');
const { estimateTokens, isWithinTokenLimit } = require('../utils/tokenizer');
const { summarizeConversation } = require('../utils/summarizer');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './chatbot.db',
  logging: false // Disable verbose SQL logs
});

// Define Conversation model
const Conversation = require('../models/Conversation')(sequelize);

// Sync database
sequelize.sync({ alter: true })
  .then(() => console.log('SQLite database synced'))
  .catch(err => console.error('SQLite sync error:', err.message));

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error('Fehler: Kein API-Key gefunden. Bitte setze die Umgebungsvariable API_KEY.');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function logUnansweredQuestion(question) {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const logFile = path.resolve(__dirname, '../ai_fragen/offene_fragen.txt');
    const timestamp = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
    const logEntry = `[${timestamp}] Frage: ${question}\n`;
    await fs.appendFile(logFile, logEntry, 'utf8');
    console.log(`Unanswered question logged to ${logFile}`);
  } catch (error) {
    console.error('Fehler beim Protokollieren der offenen Frage:', error.message);
  }
}

async function generateResponse(req, res) {
  try {
    const { prompt, conversationId } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt ist erforderlich' });
    }

    // Generate new conversationId if not provided
    const convoId = conversationId || new Date().toISOString() + Math.random().toString(36).slice(2);
    console.log(`Processing conversationId: ${convoId}`);

    // Retrieve or create conversation
    let conversation = await Conversation.findOne({ where: { conversationId: convoId } });
    if (!conversation) {
      conversation = await Conversation.create({ conversationId: convoId, messages: [] });
      console.log(`Created new conversation: ${convoId}`);
    } else {
      console.log(`Found conversation: ${convoId}, messages: ${conversation.messages.length}`);
    }

    // Add user prompt to conversation
    const userMessage = {
      text: prompt,
      isUser: true,
      timestamp: new Date().toISOString()
    };
    conversation.messages = [...conversation.messages, userMessage];
    conversation.changed('messages', true); // Mark messages as changed
    try {
      await conversation.save();
      console.log(`Saved user message: ${prompt}`);
    } catch (saveError) {
      console.error(`Failed to save user message: ${saveError.message}`);
      throw saveError;
    }

    // Read cached file contents
    const hochschulText = await getCached('ai_input/Hochschul_ABC_2025_text.txt');
    const faqText = await getCached('ai_input/faq.txt');

    // Format conversation history for prompt
    const historyText = conversation.messages.map(m => 
      `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`
    ).join('\n');

    // Check token limit and summarize if needed
    let messagesToUse = conversation.messages;
    const fullText = `
      **Inhalt von Hochschul_ABC_2025_text.txt**:
      ${hochschulText}
      
      **Inhalt von faq.txt**:
      ${faqText}
      
      **Gesprächsverlauf**:
      ${historyText}
      
      Benutzerfrage: ${prompt}
    `;
    if (!isWithinTokenLimit(fullText, 6000)) {
      messagesToUse = await summarizeConversation(conversation.messages);
      conversation.messages = messagesToUse;
      conversation.changed('messages', true); // Mark messages as changed
      try {
        await conversation.save();
        console.log(`Summarized conversation, new message count: ${messagesToUse.length}`);
      } catch (saveError) {
        console.error(`Failed to save summarized messages: ${saveError.message}`);
        throw saveError;
      }
    }

    // Create the full prompt
    const fullPrompt = `
      Du bist ein Agent, der ausschließlich Fragen basierend auf den folgenden Informationen beantwortet:
      
      **Inhalt von Hochschul_ABC_2025_text.txt**:
      ${hochschulText}
      
      **Inhalt von faq.txt**:
      ${faqText}
      
      **Gesprächsverlauf**:
      ${messagesToUse.map(m => `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}
      
      Benutzerfrage: ${prompt}
      
      Anweisungen:
      - Beantworte die Frage nur, wenn sie direkt auf den Inhalt der beiden Dateien oder den Gesprächsverlauf bezogen ist.
      - Wenn die Frage nicht beantwortet werden kann, antworte mit: "Diese Frage kann basierend auf den bereitgestellten Informationen nicht beantwortet werden."
      - Gib keine Informationen oder Vermutungen außerhalb der bereitgestellten Dateien und des Gesprächsverlaufs.
      - Halte die Antwort präzise und klar.
    `;

    // Generate response
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    // Add AI response to conversation
    const aiMessage = {
      text,
      isUser: false,
      timestamp: new Date().toISOString()
    };
    conversation.messages = [...conversation.messages, aiMessage];
    conversation.changed('messages', true); // Mark messages as changed
    try {
      await conversation.save();
      console.log(`Saved AI response: ${text.slice(0, 50)}...`);
    } catch (saveError) {
      console.error(`Failed to save AI response: ${saveError.message}`);
      throw saveError;
    }

    // Log unanswered questions
    if (text.includes('Diese Frage kann basierend auf den bereitgestellten Informationen nicht beantwortet werden')) {
      await logUnansweredQuestion(prompt);
    }

    res.json({ response: text, conversationId: convoId });
  } catch (error) {
    console.error('Fehler beim Generieren der Antwort:', error.message);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
}

module.exports = { generateResponse, Conversation };
