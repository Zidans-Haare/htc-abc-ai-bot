const OpenAI = require('openai');

let sharedClient = null;

function getClient(explicitKey = null, backend = false) {
  const prefix = backend ? 'BACKEND_' : '';
  const apiKey = explicitKey || process.env[prefix + 'AI_API_KEY'];
  if (!apiKey) {
    throw new Error(`${prefix}AI_API_KEY environment variable not set.`);
  }
  const baseURL = process.env[prefix + 'AI_BASE_URL'] || 'https://chat-ai.academiccloud.de/v1';

  if (explicitKey) {
    return new OpenAI({ apiKey, baseURL });
  }

  if (!sharedClient) {
    sharedClient = new OpenAI({ apiKey, baseURL });
  }

  return sharedClient;
}

async function chatCompletion(messages, options = {}) {
  const prefix = options.backend ? 'BACKEND_' : '';
  const client = getClient(options.apiKey, options.backend);
  const model = options.model || process.env[prefix + 'AI_MODEL'];
  const temperature = options.temperature || parseFloat(process.env[prefix + 'AI_TEMPERATURE']);
  const maxTokens = options.maxTokens || parseInt(process.env[prefix + 'AI_MAX_TOKENS']);

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return { content: response.choices[0].message.content };
}

async function* chatCompletionStream(messages, options = {}) {
  const prefix = options.backend ? 'BACKEND_' : '';
  const client = getClient(options.apiKey, options.backend);
  const model = options.model || process.env[prefix + 'AI_MODEL'];
  const temperature = options.temperature || parseFloat(process.env[prefix + 'AI_TEMPERATURE']);
  const maxTokens = options.maxTokens || parseInt(process.env[prefix + 'AI_MAX_TOKENS']);

  const stream = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) {
      yield { token };
    }
  }
}

module.exports = {
  chatCompletion,
  chatCompletionStream,
};
