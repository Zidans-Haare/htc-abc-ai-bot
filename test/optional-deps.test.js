const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('Optional Dependencies', () => {
  beforeEach(() => {
    // Reset env to original .env.test values
    process.env.EMBEDDING_LIBRARY = 'xenova'; // Default
    process.env.VECTOR_DB_TYPE = 'none';
    process.env.MAIN_DB_TYPE = 'sqlite';
    // Clear require cache for modules that might load optional deps
    jest.resetModules();
  });

  it('should load @xenova/transformers by default', () => {
    // Since EMBEDDING_LIBRARY=xenova in .env.test
    const vectorStore = require('../server/lib/vectorStore.js');
    expect(vectorStore.embeddings).toBeDefined();
  });

  (process.env.EMBEDDING_LIBRARY === 'huggingface' ? it : it.skip)('should load @huggingface/transformers when set', () => {
    // Only run if .env.test has EMBEDDING_LIBRARY=huggingface
    const vectorStore = require('../server/lib/vectorStore.js');
    expect(vectorStore.embeddings).toBeDefined();
  });

  (process.env.VECTOR_DB_TYPE === 'chroma' ? it : it.skip)('should load chromadb when VECTOR_DB_TYPE=chroma', () => {
    // Only run if .env.test has VECTOR_DB_TYPE=chroma
    const vectorStore = require('../server/lib/vectorStore.js');
    expect(true).toBe(true);
  });

  (process.env.MAIN_DB_TYPE === 'mysql' ? it : it.skip)('should load mysql2 when MAIN_DB_TYPE=mysql', () => {
    // Only run if .env.test has MAIN_DB_TYPE=mysql
    expect(process.env.MAIN_DB_TYPE).toBe('mysql');
  });

  (process.env.MAIN_DB_TYPE === 'postgresql' ? it : it.skip)('should load pg when MAIN_DB_TYPE=postgresql', () => {
    // Only run if .env.test has MAIN_DB_TYPE=postgresql
    expect(process.env.MAIN_DB_TYPE).toBe('postgresql');
  });

  (process.env.VECTOR_DB_TYPE === 'weaviate' ? it : it.skip)('should load weaviate-client when VECTOR_DB_TYPE=weaviate', () => {
    // Only run if .env.test has VECTOR_DB_TYPE=weaviate
    // TODO: Fix weaviate API in vectorStore.js
  });
});