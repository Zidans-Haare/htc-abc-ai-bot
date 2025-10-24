const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const multer = require('multer');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');

const prisma = new PrismaClient();
const upload = multer({ dest: 'temp/' });

const BACKUP_PATH = process.env.BACKUP_PATH || 'backups';
let backupInProgress = false;

async function getSchemaHash() {
  const schemaPath = path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma');
  const schemaContent = await fsPromises.readFile(schemaPath, 'utf8');
  return crypto.createHash('sha256').update(schemaContent).digest('hex');
}

async function createTempPrisma() {
  const tempDbPath = path.join(__dirname, '..', '..', 'temp_import.db');
  const tempUrl = `file:${tempDbPath}`;
  const tempPrisma = new PrismaClient({ datasourceUrl: tempUrl });
  // Ensure temp DB is empty (delete if exists)
  try {
    await fsPromises.unlink(tempDbPath);
  } catch {}
  return { tempPrisma, tempDbPath };
}

module.exports = (adminAuth) => {
  // Ensure backup dir exists
  fsPromises.mkdir(BACKUP_PATH, { recursive: true }).catch(() => {});

  router.post('/create', adminAuth, async (req, res) => {
    if (backupInProgress) {
      return res.status(409).json({ error: 'Backup already in progress' });
    }
    const { users, artikels, fragen, conversations, dokumente, bilder, feedback, dashboard } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.zip`;

    backupInProgress = true;
    // Create backup synchronously
    await createBackup({ users, artikels, fragen, conversations, dokumente, bilder, feedback, dashboard }, filename);

    res.json({ filename, status: 'completed', message: 'Backup created successfully.' });
  });

  async function createBackup(options, filename) {
    const filepath = path.join(BACKUP_PATH, filename);
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = fs.createWriteStream(filepath);
    archive.pipe(output);

    try {
      // Add schema hash and schema file
      const schemaHash = await getSchemaHash();
      archive.append(schemaHash, { name: 'schema-hash.txt' });
      const schemaPath = path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma');
      archive.file(schemaPath, { name: 'schema.prisma' });

      // Create temp DB
      const tempDbPath = path.join(__dirname, '..', '..', '..', 'temp', 'backup_temp.db');
      const tempDb = new Database(tempDbPath);
      // Push schema to create tables
      execSync(`DATABASE_URL=file:${tempDbPath} npx prisma db push --accept-data-loss`, { stdio: 'inherit' });

       // Insert data for selected tables
       if (options.users) {
         const data = await prisma.users.findMany();
         console.log(`Backing up ${data.length} users`);
         const insert = tempDb.prepare('INSERT INTO users (id, username, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
         for (const item of data) {
           insert.run(item.id, item.username, item.password, item.role, item.created_at.toISOString(), item.updated_at.toISOString());
         }
       }
       if (options.artikels) {
         const data = await prisma.hochschuhl_abc.findMany();
         console.log(`Backing up ${data.length} artikels`);
         const insert = tempDb.prepare('INSERT INTO hochschuhl_abc (id, article, description, editor, active, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
         for (const item of data) {
           insert.run(item.id, item.article, item.description, item.editor, item.active ? 1 : 0, item.archived ? item.archived.toISOString() : null, item.created_at.toISOString(), item.updated_at.toISOString());
         }
       }
       if (options.fragen) {
         const data = await prisma.questions.findMany();
         console.log(`Backing up ${data.length} fragen`);
         const insert = tempDb.prepare('INSERT INTO questions (id, question, answer, user, category_id, archived, linked_article_id, answered, spam, deleted, translation, feedback, answered_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
         for (const item of data) {
           insert.run(item.id, item.question, item.answer, item.user, item.category_id, item.archived ? 1 : 0, item.linked_article_id, item.answered ? 1 : 0, item.spam ? 1 : 0, item.deleted ? 1 : 0, item.translation, item.feedback, item.answered_at ? item.answered_at.toISOString() : null, item.created_at.toISOString(), item.updated_at.toISOString());
         }
        // Add txt files
        try {
          const unanswered = await fsPromises.readFile('ai_fragen/offene_fragen.txt', 'utf8');
          archive.append(unanswered, { name: 'offene_fragen.txt' });
        } catch {}
        try {
          const faq = await fsPromises.readFile('ai_input/faq.txt', 'utf8');
          archive.append(faq, { name: 'faq.txt' });
        } catch {}
      }
       if (options.conversations) {
         const convs = await prisma.conversations.findMany({ include: { messages: true } });
         console.log(`Backing up ${convs.length} conversations`);
         const convInsert = tempDb.prepare('INSERT INTO conversations (id, anonymous_user_id, category, ai_confidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
         const msgInsert = tempDb.prepare('INSERT INTO messages (id, conversation_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
         for (const conv of convs) {
           convInsert.run(conv.id, conv.anonymous_user_id, conv.category, conv.ai_confidence, conv.created_at.toISOString(), conv.updated_at.toISOString());
           for (const msg of conv.messages) {
             msgInsert.run(msg.id, msg.conversation_id, msg.role, msg.content, msg.created_at.toISOString(), msg.updated_at.toISOString());
           }
         }
       }
      if (options.dokumente) {
        const docs = await prisma.documents.findMany();
        console.log(`Backing up ${docs.length} documents`);
        const insert = tempDb.prepare('INSERT INTO documents (id, article_id, filepath, file_type, description, uploaded_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const item of docs) {
          insert.run(item.id, item.article_id, item.filepath, item.file_type, item.description, item.uploaded_at.toISOString(), item.created_at.toISOString(), item.updated_at.toISOString());
        }
         // Add files
         for (const doc of docs) {
           const filePath = `uploads/documents/${doc.filepath}`;
           console.log(`Adding document file: ${filePath}`);
           if (fs.existsSync(filePath)) {
             try {
               archive.file(filePath, { name: `documents/${doc.filepath}` });
               console.log(`Added document file: ${doc.filepath}`);
             } catch (err) {
               console.log(`Failed to add document file: ${doc.filepath}, error: ${err.message}`);
             }
           } else {
             console.log(`Document file not found: ${filePath}`);
           }
         }
      }
      if (options.bilder) {
        const imgs = await prisma.images.findMany();
        console.log(`Backing up ${imgs.length} images`);
        const insert = tempDb.prepare('INSERT INTO images (id, filename, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
        for (const item of imgs) {
          insert.run(item.id, item.filename, item.description, item.created_at.toISOString(), item.updated_at.toISOString());
        }
        // Add files
        for (const img of imgs) {
          const filePath = `uploads/images/${img.filename}`;
          console.log(`Adding image file: ${filePath}`);
          if (fs.existsSync(filePath)) {
            try {
              archive.file(filePath, { name: `images/${img.filename}` });
              console.log(`Added image file: ${img.filename}`);
            } catch (err) {
              console.log(`Failed to add image file: ${img.filename}, error: ${err.message}`);
            }
          } else {
            console.log(`Image file not found: ${filePath}`);
          }
        }
      }
       if (options.feedback) {
         const data = await prisma.feedback.findMany();
         console.log(`Backing up ${data.length} feedback`);
         const insert = tempDb.prepare('INSERT INTO feedback (id, user_id, text, email, rating, conversation_id, attached_chat_history, submitted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
         for (const item of data) {
           insert.run(item.id, item.user_id, item.text, item.email, item.rating, item.conversation_id, item.attached_chat_history, item.submitted_at.toISOString(), item.created_at.toISOString(), item.updated_at.toISOString());
         }
       }
       if (options.dashboard) {
         const articleViews = await prisma.article_views.findMany();
         console.log(`Backing up ${articleViews.length} article_views`);
         const insertAV = tempDb.prepare('INSERT INTO article_views (id, article_id, user_id, viewed_at, question_context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
         for (const item of articleViews) {
           insertAV.run(item.id, item.article_id, item.user_id, item.viewed_at.toISOString(), item.question_context, item.created_at.toISOString(), item.updated_at.toISOString());
         }
         const pageViews = await prisma.page_views.findMany();
         console.log(`Backing up ${pageViews.length} page_views`);
         const insertPV = tempDb.prepare('INSERT INTO page_views (id, path, timestamp, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
         for (const item of pageViews) {
           insertPV.run(item.id, item.path, item.timestamp ? item.timestamp.toISOString() : null, item.created_at.toISOString(), item.updated_at.toISOString());
         }
         const dailyStats = await prisma.daily_question_stats.findMany();
         console.log(`Backing up ${dailyStats.length} daily_question_stats`);
         const insertDS = tempDb.prepare('INSERT INTO daily_question_stats (id, analysis_date, normalized_question, question_count, topic, languages_detected, original_questions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
         for (const item of dailyStats) {
           insertDS.run(item.id, item.analysis_date, item.normalized_question, item.question_count, item.topic, item.languages_detected, item.original_questions, item.created_at.toISOString(), item.updated_at.toISOString());
         }
         const dailyUnansweredStats = await prisma.daily_unanswered_stats.findMany();
         console.log(`Backing up ${dailyUnansweredStats.length} daily_unanswered_stats`);
         const insertDUS = tempDb.prepare('INSERT INTO daily_unanswered_stats (id, analysis_date, normalized_question, question_count, topic, languages_detected, original_questions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
         for (const item of dailyUnansweredStats) {
           insertDUS.run(item.id, item.analysis_date, item.normalized_question, item.question_count, item.topic, item.languages_detected, item.original_questions, item.created_at.toISOString(), item.updated_at.toISOString());
         }
         const questionAnalysisCache = await prisma.question_analysis_cache.findMany();
         console.log(`Backing up ${questionAnalysisCache.length} question_analysis_cache`);
         const insertQAC = tempDb.prepare('INSERT INTO question_analysis_cache (id, cache_key, normalized_question, question_count, topic, languages_detected, original_questions, is_processing, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
         for (const item of questionAnalysisCache) {
           insertQAC.run(item.id, item.cache_key, item.normalized_question, item.question_count, item.topic, item.languages_detected, item.original_questions, item.is_processing ? 1 : 0, item.created_at.toISOString(), item.updated_at.toISOString());
         }
         const tokenUsage = await prisma.token_usage.findMany();
         console.log(`Backing up ${tokenUsage.length} token_usage`);
         const insertTU = tempDb.prepare('INSERT INTO token_usage (id, token_count, timestamp, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
         for (const item of tokenUsage) {
           insertTU.run(item.id, item.token_count, item.timestamp ? item.timestamp.toISOString() : null, item.created_at.toISOString(), item.updated_at.toISOString());
         }
         const userSessions = await prisma.user_sessions.findMany({ include: { chat_interactions: true } });
         console.log(`Backing up ${userSessions.length} user_sessions`);
         const sessInsert = tempDb.prepare('INSERT INTO user_sessions (id, session_id, ip_address, user_agent, started_at, last_activity, questions_count, successful_answers, ended_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
         const interInsert = tempDb.prepare('INSERT INTO chat_interactions (id, session_id, question, answer, was_successful, response_time_ms, tokens_used, timestamp, error_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
         for (const sess of userSessions) {
           sessInsert.run(sess.id, sess.session_id, sess.ip_address, sess.user_agent, sess.started_at ? sess.started_at.toISOString() : null, sess.last_activity ? sess.last_activity.toISOString() : null, sess.questions_count, sess.successful_answers, sess.ended_at ? sess.ended_at.toISOString() : null, sess.created_at.toISOString(), sess.updated_at.toISOString());
           for (const inter of sess.chat_interactions) {
             interInsert.run(inter.id, inter.session_id, inter.question, inter.answer, inter.was_successful ? 1 : 0, inter.response_time_ms, inter.tokens_used, inter.timestamp ? inter.timestamp.toISOString() : null, inter.error_message, inter.created_at.toISOString(), inter.updated_at.toISOString());
           }
         }
      }

       // Add DB to archive
       tempDb.close();
       console.log('Adding backup.db to archive');
       archive.file(tempDbPath, { name: 'backup.db' });

        console.log('Finalizing backup archive');
        await new Promise((resolve, reject) => {
          output.on('close', () => {
            console.log(`Backup created: ${filename}`);
            resolve();
          });
          output.on('error', reject);
          archive.finalize();
        });

       // Clean up temp file after archive is complete
       await fsPromises.unlink(tempDbPath);
    } catch (err) {
      console.error('Backup creation failed', err);
    } finally {
      backupInProgress = false;
    }
  }

  router.get('/list', adminAuth, async (req, res) => {
    try {
      const files = await fsPromises.readdir(BACKUP_PATH);
      const backups = [];
      for (const file of files) {
        if (file.endsWith('.zip')) {
          const stat = await fsPromises.stat(path.join(BACKUP_PATH, file));
          backups.push({
            filename: file,
            date: stat.mtime,
            size: stat.size
          });
        }
      }
      backups.sort((a, b) => b.date - a.date);
      res.json(backups);
    } catch (err) {
      console.error('List backups failed', err);
      res.status(500).json({ error: 'List backups failed' });
    }
  });

  router.delete('/:filename', adminAuth, async (req, res) => {
    const { filename } = req.params;
    try {
      await fsPromises.unlink(path.join(BACKUP_PATH, filename));
      res.json({ success: true });
    } catch (err) {
      console.error('Delete backup failed', err);
      res.status(500).json({ error: 'Delete backup failed' });
    }
  });

  router.put('/:filename/rename', adminAuth, async (req, res) => {
    const { filename } = req.params;
    const { newName } = req.body;
    try {
      await fsPromises.rename(path.join(BACKUP_PATH, filename), path.join(BACKUP_PATH, newName));
      res.json({ success: true });
    } catch (err) {
      console.error('Rename backup failed', err);
      res.status(500).json({ error: 'Rename backup failed' });
    }
  });

  router.get('/:filename/files', adminAuth, async (req, res) => {
    const { filename } = req.params;
    const filepath = path.join(BACKUP_PATH, filename);
    try {
      const directory = await unzipper.Open.file(filepath);
      const available = [];

      // Check for backup.db and tables with data
      const dbFile = directory.files.find(f => f.path === 'backup.db');
      if (dbFile) {
        const content = await dbFile.buffer();
        const tempDbPath = path.join('temp', 'check_backup.db');
        await fsPromises.writeFile(tempDbPath, content);
        const tempDb = new Database(tempDbPath);

        const tableChecks = {
          users: 'SELECT COUNT(*) as count FROM users',
          hochschuhl_abc: 'SELECT COUNT(*) as count FROM hochschuhl_abc',
          questions: 'SELECT COUNT(*) as count FROM questions',
          conversations: 'SELECT COUNT(*) as count FROM conversations',
          documents: 'SELECT COUNT(*) as count FROM documents',
          images: 'SELECT COUNT(*) as count FROM images',
          feedback: 'SELECT COUNT(*) as count FROM feedback',
          article_views: 'SELECT COUNT(*) as count FROM article_views',
          page_views: 'SELECT COUNT(*) as count FROM page_views',
          daily_question_stats: 'SELECT COUNT(*) as count FROM daily_question_stats',
          daily_unanswered_stats: 'SELECT COUNT(*) as count FROM daily_unanswered_stats',
          question_analysis_cache: 'SELECT COUNT(*) as count FROM question_analysis_cache',
          token_usage: 'SELECT COUNT(*) as count FROM token_usage',
          user_sessions: 'SELECT COUNT(*) as count FROM user_sessions',
          chat_interactions: 'SELECT COUNT(*) as count FROM chat_interactions'
        };

        for (const [key, query] of Object.entries(tableChecks)) {
          try {
            const result = tempDb.prepare(query).get();
            if (result.count > 0) {
              available.push(key);
            }
          } catch {}
        }

        tempDb.close();
        await fsPromises.unlink(tempDbPath);
      }

      // Check for folders with files
      const hasImages = directory.files.some(f => f.path.startsWith('images/') && f.type === 'File');
      if (hasImages) available.push('images');

      const hasDocuments = directory.files.some(f => f.path.startsWith('documents/') && f.type === 'File');
      if (hasDocuments) available.push('documents');

      res.json({ files: available });
    } catch (err) {
      console.error('Read backup files failed', err);
      res.status(500).json({ error: 'Failed to read backup files' });
    }
  });

  router.post('/upload', adminAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = req.file.originalname;
    const dest = path.join(BACKUP_PATH, filename);
    await fsPromises.rename(req.file.path, dest);
    res.json({ filename });
  });

  router.post('/:filename/import', adminAuth, async (req, res) => {
    const { filename } = req.params;
    const { mode, selected } = req.body; // mode: 'replace', 'append-override', 'append-keep'; selected: { users: true, artikels: true, ... }
    console.log(`Import received for ${filename}, mode: ${mode}, selected:`, selected);
    const filepath = path.join(BACKUP_PATH, filename);

    try {
    const directory = await unzipper.Open.file(filepath);
    let backupSchemaHash = null;
    let tempDb = null;
    for (const file of directory.files) {
      if (file.type === 'File') {
        const content = await file.buffer();
        if (file.path === 'schema-hash.txt') {
          backupSchemaHash = content.toString().trim();
        } else if (file.path === 'backup.db') {
          // Save temp DB
          const tempDbPath = path.join('temp', 'backup.db');
          await fsPromises.writeFile(tempDbPath, content);
          tempDb = new Database(tempDbPath);
        } else {
          // For files, save temporarily
          const tempPath = path.join('temp', file.path);
          await fsPromises.mkdir(path.dirname(tempPath), { recursive: true });
          await fsPromises.writeFile(tempPath, content);
        }
      }
    }

    // Check schema compatibility
    const currentSchemaHash = await getSchemaHash();
    if (backupSchemaHash && backupSchemaHash !== currentSchemaHash) {
      console.warn(`Schema mismatch: backup hash ${backupSchemaHash}, current hash ${currentSchemaHash}. Upgrading temp DB.`);
      // Push current schema to temp DB
      const tempDbPath = path.join('temp', 'backup.db');
      execSync(`DATABASE_URL=file:${tempDbPath} npx prisma db push --schema ${path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma')} --accept-data-loss`, { stdio: 'inherit' });
    }

    // Transfer data from temp DB to main DB
    if (selected.users) {
      const data = tempDb.prepare('SELECT * FROM users').all();
      console.log(`Transferring ${data.length} users`);
      if (mode === 'replace') await prisma.users.deleteMany();
      for (const item of data) {
        if (mode === 'append-keep') {
          const existing = await prisma.users.findUnique({ where: { id: item.id } });
          if (existing) continue;
        }
        await prisma.users.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
    }
    if (selected.artikels) {
      const data = tempDb.prepare('SELECT * FROM hochschuhl_abc').all();
      console.log(`Transferring ${data.length} articles`);
      if (mode === 'replace') await prisma.hochschuhl_abc.deleteMany();
      for (const item of data) {
        if (mode === 'append-keep') {
          const existing = await prisma.hochschuhl_abc.findUnique({ where: { id: item.id } });
          if (existing) continue;
        }
        await prisma.hochschuhl_abc.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
    }
    if (selected.fragen) {
      const data = tempDb.prepare('SELECT * FROM questions').all();
      console.log(`Transferring ${data.length} questions`);
      if (mode === 'replace') await prisma.questions.deleteMany();
      for (const item of data) {
        if (mode === 'append-keep') {
          const existing = await prisma.questions.findUnique({ where: { id: item.id } });
          if (existing) continue;
        }
        await prisma.questions.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
    }
    if (selected.conversations) {
      const convData = tempDb.prepare('SELECT * FROM conversations').all();
      console.log(`Transferring ${convData.length} conversations`);
      if (mode === 'replace') await prisma.conversations.deleteMany();
      for (const item of convData) {
        if (mode === 'append-keep') {
          const existing = await prisma.conversations.findUnique({ where: { id: item.id } });
          if (existing) continue;
        }
        await prisma.conversations.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      const msgData = tempDb.prepare('SELECT * FROM messages').all();
      console.log(`Transferring ${msgData.length} messages`);
      if (mode === 'replace') await prisma.messages.deleteMany();
      for (const item of msgData) {
        if (mode === 'append-keep') {
          const existing = await prisma.messages.findUnique({ where: { id: item.id } });
          if (existing) continue;
        }
        await prisma.messages.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
    }
    if (selected.dokumente) {
      const data = tempDb.prepare('SELECT * FROM documents').all();
      console.log(`Transferring ${data.length} documents`);
      if (mode === 'replace') await prisma.documents.deleteMany();
      for (const item of data) {
        if (mode === 'append-keep') {
          const existing = await prisma.documents.findUnique({ where: { id: item.id } });
          if (existing) continue;
        }
        await prisma.documents.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      // Handle files
      const docDir = path.join('uploads', 'documents');
      if (mode === 'replace') {
        try {
          await fsPromises.rm(docDir, { recursive: true, force: true });
        } catch {}
      }
      for (const doc of data) {
        const src = path.join('temp', 'documents', doc.filepath);
        const dest = path.join(docDir, doc.filepath);
        try {
          await fsPromises.mkdir(path.dirname(dest), { recursive: true });
          await fsPromises.copyFile(src, dest);
        } catch {}
      }
    }
    if (selected.bilder) {
      const data = tempDb.prepare('SELECT * FROM images').all();
      console.log(`Transferring ${data.length} images`);
      if (mode === 'replace') await prisma.images.deleteMany();
      for (const item of data) {
        if (mode === 'append-keep') {
          const existing = await prisma.images.findUnique({ where: { id: item.id } });
          if (existing) continue;
        }
        await prisma.images.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      // Handle files
      const imgDir = path.join('uploads', 'images');
      if (mode === 'replace') {
        try {
          await fsPromises.rm(imgDir, { recursive: true, force: true });
        } catch {}
      }
      for (const img of data) {
        const src = path.join('temp', 'images', img.filename);
        const dest = path.join(imgDir, img.filename);
        try {
          await fsPromises.mkdir(path.dirname(dest), { recursive: true });
          await fsPromises.copyFile(src, dest);
        } catch {}
      }
    }
    if (selected.feedback) {
      const data = tempDb.prepare('SELECT * FROM feedback').all();
      console.log(`Transferring ${data.length} feedback`);
      if (mode === 'replace') await prisma.feedback.deleteMany();
      for (const item of data) {
        if (mode === 'append-keep') {
          const existing = await prisma.feedback.findUnique({ where: { id: item.id } });
          if (existing) continue;
        }
        await prisma.feedback.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
    }
    if (selected.dashboard) {
      const tables = ['article_views', 'page_views', 'daily_question_stats', 'daily_unanswered_stats', 'question_analysis_cache', 'token_usage', 'user_sessions', 'chat_interactions'];
      for (const table of tables) {
        const data = tempDb.prepare(`SELECT * FROM ${table}`).all();
        console.log(`Transferring ${data.length} ${table}`);
        if (mode === 'replace') await prisma[table].deleteMany();
        for (const item of data) {
          const where = table === 'user_sessions' ? { session_id: item.session_id } : { id: item.id };
          if (mode === 'append-keep') {
            const existing = await prisma[table].findUnique({ where });
            if (existing) continue;
          }
          await prisma[table].upsert({
            where,
            update: item,
            create: item
          });
        }
      }
    }

    // Close temp DB
    if (tempDb) tempDb.close();

    // Clean temp
    await fsPromises.rm('temp', { recursive: true, force: true });

    res.json({ success: true });

      // Transfer data from temp DB to main DB
      const transferTable = async (table, replace) => {
        const data = tempDb.prepare(`SELECT * FROM ${table}`).all();
        console.log(`Transferring ${data.length} records for ${table}`);
        if (replace) {
          // For replace mode, delete all from main
          if (table === 'users') await prisma.users.deleteMany();
          else if (table === 'hochschuhl_abc') await prisma.hochschuhl_abc.deleteMany();
          else if (table === 'questions') await prisma.questions.deleteMany();
          else if (table === 'conversations') await prisma.conversations.deleteMany();
          else if (table === 'messages') await prisma.messages.deleteMany();
          else if (table === 'documents') await prisma.documents.deleteMany();
          else if (table === 'images') await prisma.images.deleteMany();
          else if (table === 'feedback') await prisma.feedback.deleteMany();
          else if (table === 'article_views') await prisma.article_views.deleteMany();
          else if (table === 'page_views') await prisma.page_views.deleteMany();
          else if (table === 'daily_question_stats') await prisma.daily_question_stats.deleteMany();
          else if (table === 'daily_unanswered_stats') await prisma.daily_unanswered_stats.deleteMany();
          else if (table === 'question_analysis_cache') await prisma.question_analysis_cache.deleteMany();
          else if (table === 'token_usage') await prisma.token_usage.deleteMany();
          else if (table === 'user_sessions') await prisma.user_sessions.deleteMany();
          else if (table === 'chat_interactions') await prisma.chat_interactions.deleteMany();
        }
        let inserted = 0, updated = 0;
        for (const item of data) {
          if (mode === 'append-keep') {
            const where = table === 'user_sessions' ? { session_id: item.session_id } : { id: item.id };
            const existing = await prisma[table].findUnique({ where });
            if (existing) continue;
          }
          const where = table === 'user_sessions' ? { session_id: item.session_id } : { id: item.id };
          await prisma[table].upsert({
            where,
            update: item,
            create: item
          });
          // Since we don't track existing easily, assume upsert handles
        }
        console.log(`${table}: transferred`);
      };

      if (selected.users) await transferTable('users', mode === 'replace');
      if (selected.artikels) await transferTable('hochschuhl_abc', mode === 'replace');
      if (selected.fragen) await transferTable('questions', mode === 'replace');
      if (selected.conversations) {
        await transferTable('conversations', mode === 'replace');
        await transferTable('messages', mode === 'replace');
      }
      if (selected.dokumente) {
        await transferTable('documents', mode === 'replace');
        // Handle files
        const docDir = path.join('uploads', 'documents');
        if (mode === 'replace') {
          try {
            await fsPromises.rm(docDir, { recursive: true, force: true });
          } catch {}
        }
        const docs = tempDb.prepare('SELECT * FROM documents').all();
        for (const doc of docs) {
          const src = path.join('temp', 'documents', doc.filepath);
          const dest = path.join(docDir, doc.filepath);
          try {
            await fsPromises.mkdir(path.dirname(dest), { recursive: true });
            await fsPromises.copyFile(src, dest);
          } catch {}
        }
      }
      if (selected.bilder) {
        await transferTable('images', mode === 'replace');
        // Handle files
        const imgDir = path.join('uploads', 'images');
        if (mode === 'replace') {
          try {
            await fsPromises.rm(imgDir, { recursive: true, force: true });
          } catch {}
        }
        const imgs = tempDb.prepare('SELECT * FROM images').all();
        for (const img of imgs) {
          const src = path.join('temp', 'images', img.filename);
          const dest = path.join(imgDir, img.filename);
          try {
            await fsPromises.mkdir(path.dirname(dest), { recursive: true });
            await fsPromises.copyFile(src, dest);
          } catch {}
        }
      }
      if (selected.feedback) await transferTable('feedback', mode === 'replace');
      if (selected.dashboard) {
        await transferTable('article_views', mode === 'replace');
        await transferTable('page_views', mode === 'replace');
        await transferTable('daily_question_stats', mode === 'replace');
        await transferTable('daily_unanswered_stats', mode === 'replace');
        await transferTable('question_analysis_cache', mode === 'replace');
        await transferTable('token_usage', mode === 'replace');
        await transferTable('user_sessions', mode === 'replace');
        await transferTable('chat_interactions', mode === 'replace');
      }

      // Close temp DB
        if (tempDb) tempDb.close();

        // Clean temp
        await fsPromises.rm('temp', { recursive: true, force: true });

        res.json({ success: true });
      } catch (err) {
        console.error('Import failed', err);
        // Clean up on failure
        try {
          if (tempDb) tempDb.close();
          await fsPromises.rm('temp', { recursive: true, force: true });
        } catch {}
        res.status(500).json({ error: 'Import failed' });
      }
   });

  return router;
};