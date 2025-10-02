const crypto = require('crypto');
const { sequelize, KnowledgeChunk } = require('../controllers/db.cjs');

const MAX_QUERY_TERMS = 12;
const DEFAULT_TOP_K = 6;
const CACHE_TTL_MS = 5 * 60 * 1000;

const retrievalCache = new Map();

function normalizeInput(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFtsQuery(text) {
  const normalized = normalizeInput(text);
  if (!normalized) return null;

  const terms = normalized
    .split(' ')
    .filter(term => term.length > 1)
    .slice(0, MAX_QUERY_TERMS);

  if (!terms.length) return null;

  return terms.map(term => `${term}*`).join(' OR ');
}

function hashKey(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function getCachedResult(key) {
  const cached = retrievalCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    retrievalCache.delete(key);
    return null;
  }
  return cached.payload;
}

function setCachedResult(key, payload) {
  retrievalCache.set(key, { payload, timestamp: Date.now() });
  if (retrievalCache.size > 200) {
    const oldestKey = [...retrievalCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
    if (oldestKey) {
      retrievalCache.delete(oldestKey);
    }
  }
}

async function queryKnowledgeBase(matchQuery, limit) {
  const sql = `
    SELECT
      kc.id,
      kc.article_id,
      kc.chunk_index,
      kc.headline,
      kc.section_heading,
      kc.chunk_text,
      kc.chunk_tokens,
      kc.chunk_char_length,
      bm25(knowledge_chunks_fts) AS score
    FROM knowledge_chunks_fts
    JOIN knowledge_chunks kc ON kc.id = knowledge_chunks_fts.rowid
    WHERE knowledge_chunks_fts MATCH ?
    ORDER BY score ASC
    LIMIT ?;
  `;

  const [rows] = await sequelize.query(sql, {
    replacements: [matchQuery, limit]
  });

  return rows.map(row => ({
    id: row.id,
    article_id: row.article_id,
    chunk_index: row.chunk_index,
    headline: row.headline,
    section_heading: row.section_heading,
    chunk_text: row.chunk_text,
    chunk_tokens: row.chunk_tokens,
    chunk_char_length: row.chunk_char_length,
    score: row.score
  }));
}

async function fallbackChunks(limit) {
  const chunks = await KnowledgeChunk.findAll({
    where: { chunk_index: 0 },
    order: [['chunk_tokens', 'DESC']],
    limit
  });

  return chunks.map(chunk => chunk.get({ plain: true })).map(chunk => ({
    ...chunk,
    score: null
  }));
}

async function retrieveRelevantChunks({
  prompt,
  conversationMessages = [],
  limit = DEFAULT_TOP_K
} = {}) {
  const recentContext = conversationMessages
    .filter(msg => msg && msg.isUser)
    .slice(-2)
    .map(msg => msg.text)
    .join(' ');

  const compositeQuery = [prompt, recentContext].filter(Boolean).join(' ').trim();
  const matchQuery = buildFtsQuery(compositeQuery);
  const cacheKey = hashKey(`${limit}:${matchQuery || ''}`);

  if (matchQuery) {
    const cached = getCachedResult(cacheKey);
    if (cached) {
      return {
        chunks: cached.chunks,
        diagnostics: {
          matchQuery,
          fromCache: true,
          fallback: cached.diagnostics.fallback
        }
      };
    }
  }

  let chunks = [];
  let fallbackUsed = false;

  if (matchQuery) {
    chunks = await queryKnowledgeBase(matchQuery, limit);
  }

  if (!chunks.length) {
    fallbackUsed = true;
    chunks = await fallbackChunks(limit);
  }

  const payload = {
    chunks,
    diagnostics: {
      matchQuery: matchQuery || null,
      fromCache: false,
      fallback: fallbackUsed
    }
  };

  if (matchQuery) {
    setCachedResult(cacheKey, payload);
  }

  return payload;
}

module.exports = { retrieveRelevantChunks };
