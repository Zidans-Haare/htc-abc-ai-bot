let GoogleGenerativeAI = null;

async function loadGoogleSDK() {
  if (!GoogleGenerativeAI) {
    const { GoogleGenerativeAI: SDK } = await import('@google/generative-ai');
    GoogleGenerativeAI = SDK;
  }
  return GoogleGenerativeAI;
}

let sharedClient = null;

async function getClient(explicitKey = null) {
  const apiKey = explicitKey || process.env.AI_GOOGLE_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('AI_GOOGLE_API_KEY or AI_API_KEY environment variable not set.');
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
  const client = await getClient(options.apiKey);
  const modelName = options.model || process.env.AI_GOOGLE_MODEL || process.env.AI_MODEL || 'gemini-2.5-flash';
  const model = client.getGenerativeModel({ model: modelName });

  // Convert messages to Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const config = {
    temperature: options.temperature || parseFloat(process.env.AI_TEMPERATURE),
    maxOutputTokens: options.maxTokens || parseInt(process.env.AI_MAX_TOKENS),
  };

  const result = await model.generateContent({
    contents,
    generationConfig: config,
  });

  const response = result.response;
  return { content: response.text() };
}

async function* chatCompletionStream(messages, options = {}) {
  const client = await getClient(options.apiKey);
  const modelName = options.model || process.env.AI_GOOGLE_MODEL || process.env.AI_MODEL || 'gemini-2.5-flash';
  const model = client.getGenerativeModel({ model: modelName });

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const config = {
    temperature: options.temperature || parseFloat(process.env.AI_TEMPERATURE),
    maxOutputTokens: options.maxTokens || parseInt(process.env.AI_MAX_TOKENS),
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