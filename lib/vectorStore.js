const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { Weaviate } = require("@langchain/community/vectorstores/weaviate");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { Document } = require("@langchain/core/documents");
const { RecursiveCharacterTextSplitter } = require("@langchain/text-splitter");
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

// Logger setup (reuse from server or local)
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/vector-db.log' })
  ]
});

class VectorStoreManager {
  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.CHAT_AI_TOKEN,
      configuration: { baseURL: process.env.OPENAI_BASE_URL }
    });
    this.store = null;
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: parseInt(process.env.CHUNK_SIZE) || 500,
      chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 50
    });
    this.connect();
  }

  async connect() {
    const type = process.env.VECTOR_DB_TYPE;
    if (type === 'none') return;

    try {
      if (type === 'chroma') {
        this.store = new Chroma(this.embeddings, {
          collectionName: process.env.CHROMA_COLLECTION,
          url: process.env.CHROMA_URL
        });
      } else if (type === 'weaviate') {
        const weaviate = require('weaviate-ts-client');
        const client = weaviate.client({
          scheme: 'http',
          host: process.env.WEAVIATE_URL.replace('http://', '').replace('https://', ''),
          apiKey: process.env.WEAVIATE_API_KEY ? new weaviate.ApiKey(process.env.WEAVIATE_API_KEY) : undefined
        });
        this.store = new Weaviate(client, {
          indexName: process.env.WEAVIATE_COLLECTION || 'htw-kb',
          embedding: this.embeddings
        });
      }
      logger.info(`Connected to ${type} vector DB`);
    } catch (err) {
      logger.error('Vector DB connection failed:', err);
      throw err;
    }
  }

  async initVectorDB() {
    if (!this.store) return;
    try {
      await this.store.deleteCollection();
      await this.syncFromDB();
      logger.info('Vector DB initialized and synced');
    } catch (err) {
      logger.error('Init vector DB failed:', err);
      throw err;
    }
  }

  async dropVectorDB() {
    if (!this.store) return;
    try {
      await this.store.deleteCollection();
      logger.info('Vector DB cleared');
    } catch (err) {
      logger.error('Drop vector DB failed:', err);
      throw err;
    }
  }

  async syncFromDB() {
    const { HochschuhlABC } = require('../controllers/db.cjs');
    if (!this.store) return;

    const docs = [];

    // Fetch active headlines
    const headlines = await HochschuhlABC.findAll({ where: { active: true } });
    for (const h of headlines) {
      const chunks = await this.splitter.splitText(`${h.headline}\n${h.text}`);
      for (let i = 0; i < chunks.length; i++) {
        docs.push(new Document({
          pageContent: chunks[i],
          metadata: {
            source: 'headline',
            id: h.id,
            chunkIndex: i
          }
        }));
      }
    }

    // Embed and store
    await this.store.addDocuments(docs);
    logger.info(`Synced ${docs.length} chunks`);
  }

  async similaritySearch(query, k = parseInt(process.env.RETRIEVE_K) || 3) {
    if (!this.store) return [];
    try {
      const results = await this.store.similaritySearchWithScore(query, k);
      const minSimilarity = parseFloat(process.env.MIN_SIMILARITY) || 0.7;
      return results.filter(([doc, score]) => score >= minSimilarity).map(([doc, score]) => ({ ...doc, score }));
    } catch (err) {
      logger.error('Similarity search failed:', err);
      return [];
    }
  }
}

module.exports = new VectorStoreManager();