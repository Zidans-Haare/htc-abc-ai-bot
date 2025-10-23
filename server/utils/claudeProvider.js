let Anthropic = null;

async function loadClaudeSDK() {
  if (!Anthropic) {
    const { Anthropic: SDK } = await import('@anthropic-ai/sdk');
    Anthropic = SDK;
  }
  return Anthropic;
}

let sharedClient = null;

async function getClient(explicitKey = null, backend = false) {
  const prefix = backend ? 'BACKEND_' : '';
  const apiKey = explicitKey || process.env[prefix + 'AI_CLAUDE_API_KEY'] || process.env[prefix + 'AI_API_KEY'];
  if (!apiKey) {
    throw new Error(`${prefix}AI_CLAUDE_API_KEY or ${prefix}AI_API_KEY environment variable not set.`);
  }

  if (explicitKey) {
    const SDK = await loadClaudeSDK();
    return new SDK({ apiKey });
  }

  if (!sharedClient) {
    const SDK = await loadClaudeSDK();
    sharedClient = new SDK({ apiKey });
  }

  return sharedClient;
}

async function chatCompletion(messages, options = {}) {
  const prefix = options.backend ? 'BACKEND_' : '';
  const client = await getClient(options.apiKey, options.backend);
  const model = options.model || process.env[prefix + 'AI_CLAUDE_MODEL'] || process.env[prefix + 'AI_MODEL'];
  const temperature = options.temperature || parseFloat(process.env[prefix + 'AI_TEMPERATURE']);
  const maxTokens = options.maxTokens || parseInt(process.env[prefix + 'AI_MAX_TOKENS']);

  const response = await client.messages.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return { content: response.content[0].text };
}

async function* chatCompletionStream(messages, options = {}) {
  const prefix = options.backend ? 'BACKEND_' : '';
  const client = await getClient(options.apiKey, options.backend);
  const model = options.model || process.env[prefix + 'AI_CLAUDE_MODEL'] || process.env[prefix + 'AI_MODEL'];
  const temperature = options.temperature || parseFloat(process.env[prefix + 'AI_TEMPERATURE']);
  const maxTokens = options.maxTokens || parseInt(process.env[prefix + 'AI_MAX_TOKENS']);

  const stream = await client.messages.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield { token: event.delta.text };
    }
  }
}

module.exports = {
  chatCompletion,
  chatCompletionStream,
};