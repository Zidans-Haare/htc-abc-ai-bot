let Anthropic = null;

async function loadClaudeSDK() {
  if (!Anthropic) {
    const { Anthropic: SDK } = await import('@anthropic-ai/sdk');
    Anthropic = SDK;
  }
  return Anthropic;
}

let sharedClient = null;

async function getClient(explicitKey = null) {
  const apiKey = explicitKey || process.env.AI_CLAUDE_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('AI_CLAUDE_API_KEY or AI_API_KEY environment variable not set.');
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
  const client = await getClient(options.apiKey);
  const model = options.model || process.env.AI_CLAUDE_MODEL || process.env.AI_MODEL;
  const temperature = options.temperature || parseFloat(process.env.AI_TEMPERATURE);
  const maxTokens = options.maxTokens || parseInt(process.env.AI_MAX_TOKENS);

  const response = await client.messages.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return { content: response.content[0].text };
}

async function* chatCompletionStream(messages, options = {}) {
  const client = await getClient(options.apiKey);
  const model = options.model || process.env.AI_CLAUDE_MODEL || process.env.AI_MODEL;
  const temperature = options.temperature || parseFloat(process.env.AI_TEMPERATURE);
  const maxTokens = options.maxTokens || parseInt(process.env.AI_MAX_TOKENS);

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