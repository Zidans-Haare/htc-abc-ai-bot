const AVG_CHARS_PER_TOKEN = 4; // Rough estimate for LLM tokenisation

function estimateTokens(text) {
  if (!text) return 0;
  const charCount = text.length;
  const wordCount = text.split(/\s+/).length;
  // Heuristic: average chars per token, adjusted by word count
  return Math.ceil((charCount / AVG_CHARS_PER_TOKEN) + wordCount / 2);
}

function isWithinTokenLimit(text, maxTokens = 6000) {
  return estimateTokens(text) <= maxTokens;
}

module.exports = { estimateTokens, isWithinTokenLimit };
