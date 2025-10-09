const OpenAI = require('openai');

const DEFAULT_MODEL = process.env.OPENAI_MODEL || process.env.KISSKI_MODEL || 'meta-llama-3.1-8b-instruct';
const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL || process.env.KISSKI_BASE_URL || 'https://chat-ai.academiccloud.de/v1';

let sharedClient = null;

function getOpenAIClient(explicitKey = null) {
  const keyToUse =
    explicitKey ||
    process.env.CHAT_AI_TOKEN ||
    process.env.OPENAI_API_KEY ||
    process.env.KISSKI_API_KEY;
  if (!keyToUse) {
    throw new Error('CHAT_AI_TOKEN (oder OPENAI_API_KEY/KISSKI_API_KEY) environment variable not set.');
  }

  if (explicitKey) {
    return new OpenAI({ apiKey: keyToUse, baseURL: DEFAULT_BASE_URL });
  }

  if (!sharedClient) {
    sharedClient = new OpenAI({ apiKey: keyToUse, baseURL: DEFAULT_BASE_URL });
  }

  return sharedClient;
}

module.exports = {
  getOpenAIClient,
  DEFAULT_MODEL,
  DEFAULT_BASE_URL,
};
