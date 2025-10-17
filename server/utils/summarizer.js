const { getOpenAIClient, DEFAULT_MODEL } = require('./openaiClient');
const { estimateTokens } = require('./tokenizer');

let cachedClient = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = getOpenAIClient();
  }
  return cachedClient;
}

async function summarizeConversation(messages) {
  const historyText = messages.map(m => `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
  const tokenCount = estimateTokens(historyText);
  if (tokenCount <= 6000) return messages;

  const instructions = 'Create a concise summary (<=100 words) capturing key context so the assistant can continue the conversation.';
  const prompt = `${instructions}\n\nConversation:\n${historyText}`;

  try {
    const client = getClient();
    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You create short conversation summaries.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const summary = completion?.choices?.[0]?.message?.content?.trim();
    if (!summary) return messages.slice(-5);

    const summaryMessage = {
      text: `Summary: ${summary}`,
      isUser: false,
      timestamp: new Date().toISOString(),
    };

    return [summaryMessage, ...messages.slice(-2)];
  } catch (error) {
    console.error('Fehler beim Zusammenfassen:', error);
    return messages.slice(-5);
  }
}

module.exports = { summarizeConversation };

