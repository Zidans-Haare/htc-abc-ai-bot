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

  router.post('/create', adminAuth, (req, res) => {
    if (backupInProgress) {
      return res.status(409).json({ error: 'Backup already in progress' });
    }
    const { users, artikels, fragen, conversations, dokumente, bilder, feedback, dashboard } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.zip`;

    backupInProgress = true;
    // Start backup in background
    createBackup({ users, artikels, fragen, conversations, dokumente, bilder, feedback, dashboard }, filename);

    res.json({ filename, status: 'started', message: 'Backup is being created, this may take a while.' });
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
      if (options.users) {
        const data = await prisma.users.findMany();
        archive.append(JSON.stringify(data, null, 2), { name: 'users.json' });
      }
      if (options.artikels) {
        const data = await prisma.hochschuhl_abc.findMany();
        archive.append(JSON.stringify(data, null, 2), { name: 'hochschuhl_abc.json' });
      }
      if (options.fragen) {
        const data = await prisma.questions.findMany();
        archive.append(JSON.stringify(data, null, 2), { name: 'questions.json' });
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
        archive.append(JSON.stringify(convs, null, 2), { name: 'conversations.json' });
      }
      if (options.dokumente) {
        const docs = await prisma.documents.findMany();
        console.log(`Backing up ${docs.length} documents`);
        archive.append(JSON.stringify(docs, null, 2), { name: 'documents.json' });
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
        archive.append(JSON.stringify(imgs, null, 2), { name: 'images.json' });
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
        archive.append(JSON.stringify(data, null, 2), { name: 'feedback.json' });
      }
      if (options.dashboard) {
        const articleViews = await prisma.article_views.findMany();
        archive.append(JSON.stringify(articleViews, null, 2), { name: 'article_views.json' });
        const pageViews = await prisma.page_views.findMany();
        archive.append(JSON.stringify(pageViews, null, 2), { name: 'page_views.json' });
         const dailyStats = await prisma.daily_question_stats.findMany();
         archive.append(JSON.stringify(dailyStats, null, 2), { name: 'daily_question_stats.json' });
         const dailyUnansweredStats = await prisma.daily_unanswered_stats.findMany();
         archive.append(JSON.stringify(dailyUnansweredStats, null, 2), { name: 'daily_unanswered_stats.json' });
         const questionAnalysisCache = await prisma.question_analysis_cache.findMany();
         archive.append(JSON.stringify(questionAnalysisCache, null, 2), { name: 'question_analysis_cache.json' });
         const tokenUsage = await prisma.token_usage.findMany();
         archive.append(JSON.stringify(tokenUsage, null, 2), { name: 'token_usage.json' });
         const userSessions = await prisma.user_sessions.findMany({ include: { chat_interactions: true } });
         archive.append(JSON.stringify(userSessions, null, 2), { name: 'user_sessions.json' });
      }

       console.log('Finalizing backup archive');
       await new Promise((resolve, reject) => {
         output.on('close', () => {
           console.log(`Backup created: ${filename}`);
           resolve();
         });
         output.on('error', reject);
         archive.finalize();
       });
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
      const files = directory.files.filter(f => f.type === 'File' && f.path.endsWith('.json')).map(f => f.path.replace('.json', ''));
      res.json({ files });
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
      const files = {};
      let backupSchemaHash = null;
      let backupSchemaContent = null;
      for (const file of directory.files) {
        if (file.type === 'File') {
          const content = await file.buffer();
          if (file.path === 'schema-hash.txt') {
            backupSchemaHash = content.toString().trim();
          } else if (file.path === 'schema.prisma') {
            backupSchemaContent = content.toString();
          } else if (file.path.endsWith('.json')) {
            files[file.path] = JSON.parse(content.toString());
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
      let useTempDb = false;
      let tempPrisma = null;
      let tempDbPath = null;
      let tempUrl = null;
      let upgradeSql = null;
      if (backupSchemaHash && backupSchemaHash !== currentSchemaHash && backupSchemaContent) {
        console.warn(`Schema mismatch: backup hash ${backupSchemaHash}, current hash ${currentSchemaHash}. Using temp DB with diff upgrade.`);
        // Save backup schema to temp file
        const backupSchemaPath = path.join(__dirname, '..', '..', 'temp_backup_schema.prisma');
        await fsPromises.writeFile(backupSchemaPath, backupSchemaContent);
        // Create temp DB with backup schema
        ({ tempPrisma, tempDbPath } = await createTempPrisma());
        tempUrl = `file:${tempDbPath}`;
        // Push backup schema to temp DB
        execSync(`DATABASE_URL=${tempUrl} npx prisma db push --schema ${backupSchemaPath} --accept-data-loss`, { stdio: 'inherit' });
        useTempDb = true;
        // Clean up temp schema file
        await fsPromises.unlink(backupSchemaPath);
      }

      const db = useTempDb ? tempPrisma : prisma;

      // Import logic
      const importTable = async (table, data, replace) => {
        console.log(`Starting import for ${table}, mode: ${mode}, replace: ${replace}, data length: ${data.length}`);
        if (replace) {
          console.log(`Dropping all records in ${table}`);
          await db[table].deleteMany();
        }
        let inserted = 0, updated = 0;
        for (const item of data) {
          if (mode === 'append-keep' && await db[table].findUnique({ where: { id: item.id } })) {
            console.log(`Skipping existing item in ${table}, id: ${item.id}`);
            continue;
          }
          const existing = await db[table].findUnique({ where: { id: item.id } });
          await db[table].upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
          if (existing) updated++; else inserted++;
        }
        console.log(`${table}: ${inserted} inserted, ${updated} updated`);
      };

      if (files['users.json'] && selected.users) await importTable('users', files['users.json'], mode === 'replace');
      if (files['hochschuhl_abc.json'] && selected.artikels) await importTable('hochschuhl_abc', files['hochschuhl_abc.json'], mode === 'replace');
      if (files['questions.json'] && selected.fragen) await importTable('questions', files['questions.json'], mode === 'replace');
      if (files['conversations.json'] && selected.conversations) {
        console.log(`Starting import for conversations, data length: ${files['conversations.json'].length}`);
        let convInserted = 0, convUpdated = 0, msgInserted = 0, msgUpdated = 0;
        for (const conv of files['conversations.json']) {
          const { messages, ...convData } = conv;
          const existingConv = await db.conversations.findUnique({ where: { id: conv.id } });
          const newConv = await db.conversations.upsert({
            where: { id: conv.id },
            update: convData,
            create: convData
          });
          if (existingConv) convUpdated++; else convInserted++;
          for (const msg of messages) {
            const existingMsg = await db.messages.findUnique({ where: { id: msg.id } });
            await db.messages.upsert({
              where: { id: msg.id },
              update: { ...msg, conversation_id: newConv.id },
              create: { ...msg, conversation_id: newConv.id }
            });
            if (existingMsg) msgUpdated++; else msgInserted++;
          }
        }
        console.log(`conversations: ${convInserted} inserted, ${convUpdated} updated; messages: ${msgInserted} inserted, ${msgUpdated} updated`);
      }
        if (files['documents.json'] && selected.dokumente) {
          await importTable('documents', files['documents.json'], mode === 'replace');
          // Handle files
          const docDir = path.join('uploads', 'documents');
          if (mode === 'replace') {
            // Delete all existing files
            try {
              await fsPromises.rm(docDir, { recursive: true, force: true });
            } catch {}
          }
          // Copy files
          for (const doc of files['documents.json']) {
            const src = path.join('temp', 'documents', doc.filepath);
            const dest = path.join(docDir, doc.filepath);
            try {
              await fsPromises.mkdir(path.dirname(dest), { recursive: true });
              await fsPromises.copyFile(src, dest);
            } catch {}
          }
        }
         if (files['images.json'] && selected.bilder) {
           await importTable('images', files['images.json'], mode === 'replace');
           // Handle files
           const imgDir = path.join('uploads', 'images');
           if (mode === 'replace') {
             // Delete all existing files
             try {
               await fsPromises.rm(imgDir, { recursive: true, force: true });
             } catch {}
           }
           // Copy files
           for (const img of files['images.json']) {
             const src = path.join('temp', 'images', img.filename);
             const dest = path.join(imgDir, img.filename);
             try {
               await fsPromises.mkdir(path.dirname(dest), { recursive: true });
               await fsPromises.copyFile(src, dest);
             } catch {}
           }
         }
       if (files['feedback.json'] && selected.feedback) await importTable('feedback', files['feedback.json'], mode === 'replace');
       if (selected.dashboard) {
         if (files['article_views.json']) await importTable('article_views', files['article_views.json'], mode === 'replace');
         if (files['page_views.json']) await importTable('page_views', files['page_views.json'], mode === 'replace');
         if (files['daily_question_stats.json']) await importTable('daily_question_stats', files['daily_question_stats.json'], mode === 'replace');
         if (files['daily_unanswered_stats.json']) await importTable('daily_unanswered_stats', files['daily_unanswered_stats.json'], mode === 'replace');
         if (files['question_analysis_cache.json']) await importTable('question_analysis_cache', files['question_analysis_cache.json'], mode === 'replace');
         if (files['token_usage.json']) await importTable('token_usage', files['token_usage.json'], mode === 'replace');
         if (files['user_sessions.json']) {
           console.log(`Starting import for user_sessions, data length: ${files['user_sessions.json'].length}`);
           let sessInserted = 0, sessUpdated = 0, interInserted = 0, interUpdated = 0;
           for (const sess of files['user_sessions.json']) {
             const { chat_interactions, ...sessData } = sess;
             const existingSess = await db.user_sessions.findUnique({ where: { session_id: sess.session_id } });
             const newSess = await db.user_sessions.upsert({
               where: { session_id: sess.session_id },
               update: sessData,
               create: sessData
             });
             if (existingSess) sessUpdated++; else sessInserted++;
             for (const inter of chat_interactions) {
               const existingInter = await db.chat_interactions.findUnique({ where: { id: inter.id } });
               await db.chat_interactions.upsert({
                 where: { id: inter.id },
                 update: { ...inter, session_id: newSess.session_id },
                 create: { ...inter, session_id: newSess.session_id }
               });
               if (existingInter) interUpdated++; else interInserted++;
             }
           }
           console.log(`user_sessions: ${sessInserted} inserted, ${sessUpdated} updated; chat_interactions: ${interInserted} inserted, ${interUpdated} updated`);
         }
       }

       if (useTempDb) {
         // Push current schema to temp DB to upgrade
         const currentSchemaPath = path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma');
         execSync(`DATABASE_URL=${tempUrl} npx prisma db push --schema ${currentSchemaPath} --accept-data-loss`, { stdio: 'inherit' });
         console.log('Upgraded temp DB to current schema');
         // Copy temp DB to main DB
         const currentDbPath = process.env.DATABASE_URL.replace('file:', '');
         await fsPromises.copyFile(tempDbPath, currentDbPath);
         await tempPrisma.$disconnect();
         await fsPromises.unlink(tempDbPath);
         console.log('Imported via temp DB and upgraded.');
       }

       // Clean temp
       await fsPromises.rm('temp', { recursive: true, force: true });

       res.json({ success: true });
     } catch (err) {
       console.error('Import failed', err);
       // Clean up on failure
       try {
         await fsPromises.rm('temp', { recursive: true, force: true });
         if (tempDbPath) await fsPromises.unlink(tempDbPath);
       } catch {}
       res.status(500).json({ error: 'Import failed' });
     }
  });

  return router;
};