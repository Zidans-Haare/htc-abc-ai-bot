const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { Weaviate } = require("@langchain/community/vectorstores/weaviate");
const { pipeline } = require('@xenova/transformers');

// Real embeddings using Xenova Transformers
class XenovaEmbeddings {
  constructor(modelName = 'Xenova/e5-mistral-7b-instruct') {
    this.modelName = modelName;
    this.pipe = null;
    this.dimension = parseInt(process.env.EMBEDDING_DIMENSION) || 4096;
    this.pooling = process.env.EMBEDDING_POOLING || 'mean';
    this.normalize = process.env.EMBEDDING_NORMALIZE === 'true' || true;
  }

  async init() {
    if (!this.pipe) {
      this.pipe = await pipeline('feature-extraction', this.modelName, { auth_token: process.env.HF_TOKEN });
    }
  }

  async embedQuery(text) {
    await this.init();
    const output = await this.pipe(text, { pooling: this.pooling, normalize: this.normalize });
    return Array.from(output.data);
  }

  async embedDocuments(texts) {
    await this.init();
    const embeddings = [];
    for (const text of texts) {
      const output = await this.pipe(text, { pooling: this.pooling, normalize: this.normalize });
      embeddings.push(Array.from(output.data));
    }
    return embeddings;
  }
}
const { Document } = require("@langchain/core/documents");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const sanitizeHtml = require('sanitize-html');
const promClient = require('prom-client');
const { execSync } = require('child_process');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });
const syncDuration = new promClient.Histogram({
  name: 'vector_sync_duration_seconds',
  help: 'Duration of vector DB sync',
  registers: [register]
});
const retrievalDuration = new promClient.Histogram({
  name: 'vector_retrieval_duration_seconds',
  help: 'Duration of similarity search',
  registers: [register]
});

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
    const modelName = process.env.EMBEDDING_MODEL ? `Xenova/${process.env.EMBEDDING_MODEL}` : 'Xenova/e5-mistral-7b-instruct';
    this.embeddings = new XenovaEmbeddings(modelName);
    this.store = null;
    this.graphData = null;
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: parseInt(process.env.CHUNK_SIZE) || 500,
      chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 50
    });
    this.pdfSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: parseInt(process.env.PDF_CHUNK_SIZE) || 300,
      chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 50
    });
    this.connect();
  }

  async connect() {
    const type = process.env.VECTOR_DB_TYPE;
    if (type === 'none') return;

    try {
      if (type === 'chroma') {
        const url = new URL(process.env.CHROMA_URL);
        this.store = new Chroma(this.embeddings, {
          collectionName: process.env.CHROMA_COLLECTION,
          host: url.hostname,
          port: url.port,
          ssl: url.protocol === 'https:'
        });
      } else if (type === 'weaviate') {
        const weaviate = require('weaviate-client');
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
      // Delete collection for Weaviate and Chroma
      if (process.env.VECTOR_DB_TYPE === 'weaviate') {
        await this.store.deleteCollection();
      } else if (process.env.VECTOR_DB_TYPE === 'chroma') {
        execSync(`curl -X POST http://localhost:8000/api/v1/reset`, { stdio: 'pipe' });
      }
      const stats = await this.syncFromDB();
      logger.info('Vector DB initialized and synced');
      return stats;
    } catch (err) {
      logger.error('Init vector DB failed:', err);
      throw err;
    }
  }

  async dropVectorDB() {
    if (!this.store) return;
    try {
      if (process.env.VECTOR_DB_TYPE === 'weaviate') {
        await this.store.deleteCollection();
      } else if (process.env.VECTOR_DB_TYPE === 'chroma') {
        execSync(`curl -X POST http://localhost:8000/api/v1/reset`, { stdio: 'inherit' });
      }
      logger.info('Vector DB cleared');
    } catch (err) {
      logger.error('Drop vector DB failed:', err);
      throw err;
    }
  }

  async syncFromDB() {
    const end = syncDuration.startTimer();
    const { HochschuhlABC } = require('../controllers/db.cjs');
    if (!this.store) return;

    const docs = [];
    let headlineCount = 0;
    let pdfCount = 0;

    // Fetch active headlines
    const headlines = await HochschuhlABC.findAll({ where: { active: true }, attributes: ['id', 'headline', 'text'] });
    headlineCount = headlines.length;
    for (const h of headlines) {
      let pageContent = `${h.headline}\n${h.text}`;
      pageContent = sanitizeHtml(pageContent);
      const chunks = await this.splitter.splitText(pageContent);
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

    // Fetch articles with PDFs
    // const articles = await HochschuhlABC.findAll({ where: { active: true, pdfPath: { [require('sequelize').Op.ne]: null } } });
    // pdfCount = articles.length;
    // for (const a of articles) {
    //   if (a.pdfPath) {
    //     const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
    //     const loader = new PDFLoader(a.pdfPath);
    //     const pdfDocs = await loader.load();
    //     for (const doc of pdfDocs) {
    //       let pageContent = doc.pageContent;
    //       pageContent = sanitizeHtml(pageContent);
    //       const chunks = await this.pdfSplitter.splitText(pageContent);
    //       for (let i = 0; i < chunks.length; i++) {
    //         docs.push(new Document({
    //           pageContent: chunks[i],
    //           metadata: {
    //             ...doc.metadata,
    //             source: 'pdf',
    //             articleId: a.id,
    //             chunkIndex: i
    //           }
    //         }));
    //       }
    //     }
    //   }
    // }

    // Embed and store in batches
    const batchSize = parseInt(process.env.SYNC_BATCH) || 100;
    for (let i = 0; i < docs.length; i += batchSize) {
      await this.store.addDocuments(docs.slice(i, i + batchSize));
    }

    // Build graph if enabled
    if (process.env.ENABLE_GRAPHRAG === 'true') {
      this.graphData = await this.buildSimpleGraph(docs);
    }

    const stats = {
      headlines: headlineCount,
      pdfs: pdfCount,
      chunks: docs.length
    };
    logger.info(`Synced ${stats.chunks} chunks from ${stats.headlines} headlines and ${stats.pdfs} PDFs`);
    end();
    return stats;
  }

  async similaritySearch(query, k = parseInt(process.env.RETRIEVE_K) || 3) {
    const end = retrievalDuration.startTimer();
    if (!this.store) return [];
    try {
      const results = await this.store.similaritySearchWithScore(query, k);
      const minSimilarity = parseFloat(process.env.MIN_SIMILARITY) || 0.7;
      const filtered = results.filter(([doc, score]) => score >= minSimilarity).map(([doc, score]) => ({ ...doc, score }));
      end();
      return filtered;
    } catch (err) {
      logger.error('Similarity search failed:', err);
      end();
      return [];
    }
  }

  async buildSimpleGraph(docs) {
    const { ChatOpenAI } = require("@langchain/openai");
    const llm = new ChatOpenAI({
      model: process.env.EMBEDDING_MODEL || 'gpt-3.5-turbo',
      openAIApiKey: process.env.CHAT_AI_TOKEN,
      configuration: { baseURL: process.env.OPENAI_BASE_URL }
    });
    const prompt = `Extract entities (e.g., Headline, Group) and relations (e.g., related_to) from: ${docs.map(d => d.pageContent).join('\n')}. Output JSON: {nodes: [{id, type, name}], edges: [{from, to, relation}]}`;
    const response = await llm.invoke(prompt);
    return JSON.parse(response.content);
  }

  async getGraphSummary(query, graph) {
    const relevantEdges = graph.edges.filter(e => e.relation.includes(query.toLowerCase()));
    return relevantEdges.map(e => `${graph.nodes.find(n => n.id === e.from).name} ${e.relation} ${graph.nodes.find(n => n.id === e.to).name}`).join('; ');
  }
}

module.exports = new VectorStoreManager();