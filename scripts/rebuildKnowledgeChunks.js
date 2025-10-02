#!/usr/bin/env node

require('dotenv').config();

const { sequelize, HochschuhlABC, KnowledgeChunk } = require('../controllers/db.cjs');
const { chunkArticle, DEFAULT_MAX_TOKENS, DEFAULT_OVERLAP_TOKENS } = require('../utils/chunker');

async function ensureSchema() {
  await KnowledgeChunk.sync();
  await sequelize.query(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts
    USING fts5(
      chunk_text,
      headline,
      section_heading,
      article_id UNINDEXED,
      chunk_index UNINDEXED
    );
  `);
}

async function rebuildChunks({
  maxTokens = DEFAULT_MAX_TOKENS,
  overlapTokens = DEFAULT_OVERLAP_TOKENS
} = {}) {
  const articles = await HochschuhlABC.findAll({
    where: {
      active: true
    },
    order: [['id', 'ASC']],
    attributes: ['id', 'headline', 'text']
  });

  const chunkPayload = [];
  for (const article of articles) {
    const chunks = chunkArticle({
      id: article.id,
      headline: article.headline,
      text: article.text || ''
    }, { maxTokens, overlapTokens });

    for (const chunk of chunks) {
      chunkPayload.push({
        article_id: chunk.article_id,
        chunk_index: chunk.chunk_index,
        headline: chunk.headline,
        section_heading: chunk.section_heading,
        chunk_text: chunk.chunk_text,
        chunk_tokens: chunk.chunk_tokens,
        chunk_char_length: chunk.chunk_char_length,
        start_offset: chunk.start_offset,
        end_offset: chunk.end_offset
      });
    }
  }

  await sequelize.transaction(async transaction => {
    await sequelize.query('DELETE FROM knowledge_chunks;', { transaction });
    await sequelize.query("DELETE FROM sqlite_sequence WHERE name='knowledge_chunks';", { transaction }).catch(() => {});
    await sequelize.query('DELETE FROM knowledge_chunks_fts;', { transaction }).catch(() => {});

    if (!chunkPayload.length) {
      return;
    }

    await KnowledgeChunk.bulkCreate(chunkPayload, { transaction });

    const storedChunks = await KnowledgeChunk.findAll({
      attributes: ['id', 'article_id', 'chunk_index'],
      order: [['article_id', 'ASC'], ['chunk_index', 'ASC']],
      transaction
    });

    if (storedChunks.length !== chunkPayload.length) {
      throw new Error(`Persisted chunk count mismatch (expected ${chunkPayload.length}, got ${storedChunks.length}).`);
    }

    const insertStatement = `
      INSERT INTO knowledge_chunks_fts(rowid, chunk_text, headline, section_heading, article_id, chunk_index)
      VALUES (?, ?, ?, ?, ?, ?);
    `;

    for (let i = 0; i < storedChunks.length; i += 1) {
      const stored = storedChunks[i];
      const payload = chunkPayload[i];
      await sequelize.query(insertStatement, {
        replacements: [
          stored.id,
          payload.chunk_text,
          payload.headline,
          payload.section_heading || '',
          payload.article_id,
          payload.chunk_index
        ],
        transaction
      });
    }
  });

  return {
    articleCount: articles.length,
    chunkCount: chunkPayload.length,
    avgChunksPerArticle: articles.length ? (chunkPayload.length / articles.length) : 0,
    maxTokens,
    overlapTokens
  };
}

async function main() {
  try {
    await ensureSchema();
    const stats = await rebuildChunks();
    console.log(`Knowledge chunks rebuilt successfully.`);
    console.log(`Articles processed: ${stats.articleCount}`);
    console.log(`Chunks generated: ${stats.chunkCount}`);
    console.log(`Average chunks per article: ${stats.avgChunksPerArticle.toFixed(2)}`);
    console.log(`Chunk configuration: maxTokens=${stats.maxTokens}, overlapTokens=${stats.overlapTokens}`);
  } catch (error) {
    console.error('Failed to rebuild knowledge chunks:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { ensureSchema, rebuildChunks };
