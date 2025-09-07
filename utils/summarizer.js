const { GoogleGenerativeAI } = require('@google/generative-ai');
const { estimateTokens } = require('./tokenizer');

// Lazy initialization - only check API key when actually needed
let genAI = null;
let model = null;

function initializeGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable not set.");
    }
    if (!genAI) {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    }
    return model;
}

async function summarizeConversation(messages) {
  const historyText = messages.map(m => `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
  const tokenCount = estimateTokens(historyText);
  if (tokenCount <= 6000) return messages; // No need to summarize

  const prompt = `
    Summarize the following conversation in 100 words or less, capturing key points and context:
    ${historyText}
    
    Return only the summary text.
  `;

  try {
    const currentModel = initializeGemini();
    const result = await currentModel.generateContent(prompt);
    const summary = (await result.response).text();
    const summaryMessage = {
      text: `Summary: ${summary}`,
      isUser: false,
      // Use ISO string to match the timestamp format of other messages
      timestamp: new Date().toISOString()
    };
    // Keep last 2 messages to maintain recent context
    return [summaryMessage, ...messages.slice(-2)];
  } catch (error) {
    console.error('Fehler beim Zusammenfassen:', error);
    return messages.slice(-5); // Fallback: keep last 5 messages
  }
}

module.exports = { summarizeConversation };
