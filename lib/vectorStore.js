const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { Weaviate } = require("@langchain/community/vectorstores/weaviate");

// Factory to create embeddings based on library
const createEmbeddings = (modelName) => {
  const lib = process.env.EMBEDDING_LIBRARY || 'xenova';
  if (lib === 'xenova') {
    return new XenovaEmbeddings(modelName);
  } else {
    return new HuggingFaceEmbeddings(modelName);
  }
};

// Real embeddings using Xenova Transformers
class XenovaEmbeddings {
  constructor(modelName = 'all-MiniLM-L6-v2') {
    this.modelName = `Xenova/${modelName}`;
    this.pipe = null;
    this.dimension = parseInt(process.env.EMBEDDING_DIMENSION) || 384;
    this.pooling = process.env.EMBEDDING_POOLING || 'mean';
    this.normalize = process.env.EMBEDDING_NORMALIZE === 'true' || true;
  }

  async init() {
    if (!this.pipe) {
      const { pipeline } = require('@xenova/transformers');
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

// Real embeddings using Hugging Face Transformers
class HuggingFaceEmbeddings {
  constructor(modelName = 'all-MiniLM-L6-v2') {
    this.modelName = modelName;
    this.pipe = null;
    this.dimension = parseInt(process.env.EMBEDDING_DIMENSION) || 384;
    this.pooling = process.env.EMBEDDING_POOLING || 'mean';
    this.normalize = process.env.EMBEDDING_NORMALIZE === 'true' || true;
  }

  async init() {
    if (!this.pipe) {
      const { pipeline } = require('@huggingface/transformers');
      this.pipe = await pipeline('feature-extraction', this.modelName, { token: process.env.HF_TOKEN });
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
const fs = require('fs');
const path = require('path');

const { DocxLoader } = require("@langchain/community/document_loaders/fs/docx");
// const { PPTXLoader } = require("@langchain/community/document_loaders/fs/pptx"); // Disabled due to missing officeparser
const { UnstructuredLoader } = require("@langchain/community/document_loaders/fs/unstructured");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");

const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();
const HochschuhlABC = prisma.hochschuhl_abc;


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
    const modelName = process.env.EMBEDDING_MODEL || 'all-MiniLM-L6-v2';
    this.embeddings = createEmbeddings(modelName);
    this.lastSync = new Date(0);
    try {
      this.lastSync = new Date(fs.readFileSync('.vectordb_last_sync', 'utf8'));
    } catch (e) {}
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

  async loadPDF(filePath) {
    try {
      const { default: pdfjs } = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
      const loader = new PDFLoader(filePath, {
        pdfjs: () => Promise.resolve(pdfjs),
        splitPages: true,
        parsedItemSeparator: "\n\n",
      });
      const docs = await loader.load();
      return docs.map(doc => ({ ...doc, metadata: { ...doc.metadata, source: filePath } }));
    } catch (err) {
      console.error(`PDF load failed: ${err.message}`);
      return [];
    }
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
    const startTime = Date.now();
    try {
      console.log('Initializing vector DB...');
      // Drop existing vectors for a clean init
      await this.dropVectorDB();
      // Force full sync for init
      const oldLastSync = this.lastSync;
      this.lastSync = new Date(0);
      const stats = await this.syncFromDB();
      this.lastSync = oldLastSync;
      const duration = (Date.now() - startTime) / 1000;
      logger.info(`Vector DB initialized and synced in ${duration.toFixed(2)} seconds`);
      console.log(`Vector DB initialized and synced in ${duration.toFixed(2)} seconds`);
      return stats;
    } catch (err) {
      logger.error('Init vector DB failed:', err);
      throw err;
    }
  }

  async syncVectorDB() {
    try {
      console.log('Syncing vector DB...');
      // Use current lastSync for incremental sync
      const stats = await this.syncFromDB();
      logger.info('Vector DB synced');
      return stats;
    } catch (err) {
      logger.error('Sync vector DB failed:', err);
      throw err;
    }
  }

  async syncVectorDB() {
    try {
      console.log('Syncing vector DB...');
      // Use current lastSync for incremental sync
      const stats = await this.syncFromDB();
      logger.info('Vector DB synced');
      return stats;
    } catch (err) {
      logger.error('Sync vector DB failed:', err);
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
    let imageCount = 0;
    let docxCount = 0, mdCount = 0, odtCount = 0, xlsxCount = 0, odpCount = 0, odsCount = 0;

    // Fetch changed headlines
    const changedHeadlines = await HochschuhlABC.findMany({ where: { updated_at: { gt: this.lastSync } }, select: { id: true, article: true, description: true, active: true } });
    for (const h of changedHeadlines) {
      if (h.active) {
        // Delete old vectors
        await this.store.delete({ filter: { $and: [{ source: 'headline' }, { id: h.id }] } });
        // Add new
        let pageContent = `${h.article}\n${h.description}`;
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
        headlineCount++;
      } else {
        // Delete
        await this.store.delete({ filter: { $and: [{ source: 'headline' }, { id: h.id }] } });
      }
    }

    // Fetch changed documents
    const changedDocuments = await prisma.documents.findMany({
      where: { updated_at: { gt: this.lastSync } },
      include: { hochschuhl_abc: true }
    });
    for (const doc of changedDocuments) {
      // Delete old
      await this.store.delete({ filter: { $and: [{ source: 'document' }, { documentId: doc.id }] } });
      // Add new if supported type
      const fullPath = path.join(__dirname, '..', 'public', 'documents', doc.filepath);
      let loader;
      if (doc.file_type === 'pdf') {
        const loadedDocs = await this.loadPDF(fullPath);
        pdfCount++;
        // Process loadedDocs similar to other loaders
        for (const d of loadedDocs) {
          let pageContent = d.pageContent;
          if (doc.hochschuhl_abc && doc.hochschuhl_abc.active) {
            pageContent = `${doc.hochschuhl_abc.article}\n${doc.hochschuhl_abc.description || ''}\n${pageContent}`;
          }
          pageContent = sanitizeHtml(pageContent);
          if (pageContent.trim() === '') continue; // Skip empty
          const chunks = await this.pdfSplitter.splitText(pageContent);
          for (let i = 0; i < chunks.length; i++) {
            docs.push(new Document({
              pageContent: chunks[i],
              metadata: {
                ...d.metadata,
                source: 'document',
                articleId: doc.article_id,
                documentId: doc.id,
                fileType: doc.file_type,
                chunkIndex: i
              }
            }));
          }
        }
      } else
      if (doc.file_type === 'docx') {
        loader = new DocxLoader(fullPath);
        docxCount++;
      } else if (doc.file_type === 'md') {
        loader = new UnstructuredLoader(fullPath);
        mdCount++;
      } else if (['odt', 'ods', 'odp'].includes(doc.file_type)) {
        loader = new UnstructuredLoader(fullPath);
        if (doc.file_type === 'odt') odtCount++;
        else if (doc.file_type === 'ods') odsCount++;
        else odpCount++;
      } else if (doc.file_type === 'xlsx') {
        loader = new UnstructuredLoader(fullPath);
        xlsxCount++;
      } else {
        continue; // unsupported
      }
      try {
        const loadedDocs = await loader.load();
        for (const d of loadedDocs) {
          let pageContent = d.pageContent;
          if (doc.hochschuhl_abc && doc.hochschuhl_abc.active) {
            pageContent = `${doc.hochschuhl_abc.article}\n${doc.hochschuhl_abc.description || ''}\n${pageContent}`;
          }
          pageContent = sanitizeHtml(pageContent);
          const chunks = await this.pdfSplitter.splitText(pageContent);
          for (let i = 0; i < chunks.length; i++) {
            docs.push(new Document({
              pageContent: chunks[i],
              metadata: {
                ...d.metadata,
                source: 'document',
                articleId: doc.article_id,
                documentId: doc.id,
                fileType: doc.file_type,
                chunkIndex: i
              }
            }));
          }
        }
      } catch (err) {
        logger.error(`Failed to load document ${doc.id}: ${err.message}`);
      }
    }

    // Fetch changed images
    const changedImages = await prisma.images.findMany({ where: { updated_at: { gt: this.lastSync } } });
    for (const img of changedImages) {
      // Delete old
      await this.store.delete({ filter: { $and: [{ source: 'image' }, { id: img.id }] } });
      // Add new
      let pageContent = `${img.filename}\n${img.description || ''}`;
      docs.push(new Document({
        pageContent,
        metadata: { source: 'image', id: img.id }
      }));
      imageCount++;
    }

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
      images: imageCount,
      docx: docxCount,
      // pptx: pptxCount, // Disabled
      md: mdCount,
      odt: odtCount,
      ods: odsCount,
      odp: odpCount,
      xlsx: xlsxCount,
      chunks: docs.length
    };
    logger.info(`Synced ${stats.chunks} chunks from ${stats.headlines} headlines, ${stats.pdfs} PDFs, ${stats.images} images, ${stats.docx} DOCX, ${stats.md} MD, ${stats.odt} ODT, ${stats.ods} ODS, ${stats.odp} ODP, ${stats.xlsx} XLSX`);
    // Update last sync
    fs.writeFileSync('.vectordb_last_sync', new Date().toISOString());
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