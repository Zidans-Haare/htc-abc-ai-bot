let providerModule = null;

async function loadProvider(provider) {
  if (!providerModule || providerModule.name !== provider) {
    let modulePath;
    switch (provider) {
      case 'chatAi':
        modulePath = './chatAiProvider.js';
        break;
      case 'openai':
        modulePath = './openaiProvider.js';
        break;
      case 'google':
        modulePath = './googleProvider.js';
        break;
      case 'claude':
        modulePath = './claudeProvider.js';
        break;
      case 'xai':
        modulePath = './xaiProvider.js';
        break;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
    providerModule = await import(modulePath);
    providerModule.name = provider;
  }
  return providerModule;
}

async function chatCompletion(messages, options = {}) {
  const provider = process.env.AI_PROVIDER;
  if (!provider) {
    throw new Error('AI_PROVIDER environment variable not set.');
  }
  const module = await loadProvider(provider);
  return module.chatCompletion(messages, options);
}

async function* chatCompletionStream(messages, options = {}) {
  const provider = process.env.AI_PROVIDER;
  if (!provider) {
    throw new Error('AI_PROVIDER environment variable not set.');
  }
  const module = await loadProvider(provider);
  yield* module.chatCompletionStream(messages, options);
}

module.exports = {
  chatCompletion,
  chatCompletionStream,
};