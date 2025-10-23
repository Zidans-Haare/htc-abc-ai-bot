let GoogleGenerativeAI = null;

async function loadGoogleSDK() {
  if (!GoogleGenerativeAI) {
    const { GoogleGenerativeAI: SDK } = await import('@google/generative-ai');
    GoogleGenerativeAI = SDK;
  }
  return GoogleGenerativeAI;
}

let sharedClient = null;

async function getClient(explicitKey = null, backend = false) {
  const prefix = backend ? 'BACKEND_' : '';
  const apiKey = explicitKey || process.env[prefix + 'AI_GOOGLE_API_KEY'] || process.env[prefix + 'AI_API_KEY'];
  if (!apiKey) {
    throw new Error(`${prefix}AI_GOOGLE_API_KEY or ${prefix}AI_API_KEY environment variable not set.`);
  }

  if (explicitKey) {
    const SDK = await loadGoogleSDK();
    return new SDK(apiKey);
  }

  if (!sharedClient) {
    const SDK = await loadGoogleSDK();
    sharedClient = new SDK(apiKey);
  }

  return sharedClient;
}

async function chatCompletion(messages, options = {}) {
  const prefix = options.backend ? 'BACKEND_' : '';
  const client = await getClient(options.apiKey, options.backend);
  const modelName = options.model || process.env[prefix + 'AI_GOOGLE_MODEL'] || process.env[prefix + 'AI_MODEL'] || 'gemini-2.5-flash';
  const model = client.getGenerativeModel({ model: modelName });

  // Convert messages to Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const config = {
    temperature: options.temperature || parseFloat(process.env[prefix + 'AI_TEMPERATURE']),
    maxOutputTokens: options.maxTokens || parseInt(process.env[prefix + 'AI_MAX_TOKENS']),
  };

  const result = await model.generateContent({
    contents,
    generationConfig: config,
  });

  const response = result.response;
  return { content: response.text() };
}

async function* chatCompletionStream(messages, options = {}) {
  const prefix = options.backend ? 'BACKEND_' : '';
  const client = await getClient(options.apiKey, options.backend);
  const modelName = options.model || process.env[prefix + 'AI_GOOGLE_MODEL'] || process.env[prefix + 'AI_MODEL'] || 'gemini-2.5-flash';
  const model = client.getGenerativeModel({ model: modelName });

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const config = {
    temperature: options.temperature || parseFloat(process.env[prefix + 'AI_TEMPERATURE']),
    maxOutputTokens: options.maxTokens || parseInt(process.env[prefix + 'AI_MAX_TOKENS']),
  };

  const streamingResponse = await model.generateContentStream({
    contents,
    generationConfig: config,
  });

  for await (const chunk of streamingResponse.stream) {
    const token = chunk.text();
    if (token) {
      yield { token };
    }
  }
}

module.exports = {
  chatCompletion,
  chatCompletionStream,
};