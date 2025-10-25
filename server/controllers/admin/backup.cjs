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

       // Utility functions for dynamic export/import
       function convertToSQLite(value) {
         if (value instanceof Date) return value.toISOString();
         if (typeof value === 'boolean') return value ? 1 : 0;
         return value;
       }

       async function exportTable(prismaModel, tableName, tempDb, data) {
         const columns = tempDb.prepare(`PRAGMA table_info(${tableName})`).all();
         const colNames = columns.map(c => c.name);
         const placeholders = colNames.map(() => '?').join(', ');
         const insert = tempDb.prepare(`INSERT INTO ${tableName} (${colNames.join(', ')}) VALUES (${placeholders})`);
         for (const item of data) {
           const values = colNames.map(col => convertToSQLite(item[col]));
           insert.run(...values);
         }
       }

       // Insert data for selected tables
       if (options.users) {
         const data = await prisma.users.findMany();
         console.log(`Backing up ${data.length} users`);
         await exportTable(prisma.users, 'users', tempDb, data);
       }
       if (options.artikels) {
         const data = await prisma.hochschuhl_abc.findMany();
         console.log(`Backing up ${data.length} artikels`);
         await exportTable(prisma.hochschuhl_abc, 'hochschuhl_abc', tempDb, data);
       }
       if (options.fragen) {
         const data = await prisma.questions.findMany();
         console.log(`Backing up ${data.length} fragen`);
         await exportTable(prisma.questions, 'questions', tempDb, data);
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
         const convs = await prisma.conversations.findMany();
         console.log(`Backing up ${convs.length} conversations`);
         await exportTable(prisma.conversations, 'conversations', tempDb, convs);
         const msgs = await prisma.messages.findMany();
         console.log(`Backing up ${msgs.length} messages`);
         await exportTable(prisma.messages, 'messages', tempDb, msgs);
       }
       if (options.dokumente) {
         const docs = await prisma.documents.findMany();
         console.log(`Backing up ${docs.length} documents`);
         await exportTable(prisma.documents, 'documents', tempDb, docs);
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
         await exportTable(prisma.images, 'images', tempDb, imgs);
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
         await exportTable(prisma.feedback, 'feedback', tempDb, data);
       }
        if (options.dashboard) {
          const tables = ['article_views', 'page_views', 'daily_question_stats', 'daily_unanswered_stats', 'question_analysis_cache', 'token_usage', 'user_sessions', 'chat_interactions'];
          for (const table of tables) {
            const data = await prisma[table].findMany(table === 'user_sessions' ? { include: { chat_interactions: true } } : {});
            console.log(`Backing up ${data.length} ${table}`);
            if (table === 'user_sessions') {
              // Handle relations
              const sessions = data;
              await exportTable(prisma.user_sessions, 'user_sessions', tempDb, sessions);
              const interactions = sessions.flatMap(s => s.chat_interactions);
              await exportTable(prisma.chat_interactions, 'chat_interactions', tempDb, interactions);
            } else {
              await exportTable(prisma[table], table, tempDb, data);
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

     // Utility functions for dynamic import
     function convertFromSQLite(item, tableName) {
       const result = { ...item };
       const model = prisma._dmmf.modelMap[tableName];
       if (!model) return result; // Fallback if model not found

       model.fields.forEach(field => {
         const value = result[field.name];
         if (value !== undefined) {
           if (field.type === 'Boolean' && typeof value === 'number' && (value === 0 || value === 1)) {
             result[field.name] = value === 1;
           } else if (field.type === 'DateTime' && typeof value === 'string') {
             result[field.name] = new Date(value);
           }
         }
       });
       return result;
     }

     async function importTable(prismaModel, tableName, tempDb, mode) {
       const data = tempDb.prepare(`SELECT * FROM ${tableName}`).all();
       console.log(`Transferring ${data.length} ${tableName}`);
       if (mode === 'replace') await prismaModel.deleteMany();

       const model = prisma._dmmf.modelMap[tableName];
       const idField = model ? model.fields.find(f => f.isId) : null;
       const whereKey = idField ? idField.name : 'id'; // Default to 'id' if not found

       for (const item of data) {
         if (mode === 'append-keep') {
           const existing = await prismaModel.findUnique({ where: { [whereKey]: item[whereKey] } });
           if (existing) continue;
         }
         const transformed = convertFromSQLite(item, tableName);
         await prismaModel.upsert({
           where: { [whereKey]: item[whereKey] },
           update: transformed,
           create: transformed
         });
       }
     }

     // Transfer data from temp DB to main DB
      if (selected.users) {
        await importTable(prisma.users, 'users', tempDb, mode);
      }
     if (selected.artikels) {
       await importTable(prisma.hochschuhl_abc, 'hochschuhl_abc', tempDb, mode);
     }
     if (selected.fragen) {
       await importTable(prisma.questions, 'questions', tempDb, mode);
     }
     if (selected.conversations) {
       await importTable(prisma.conversations, 'conversations', tempDb, mode);
       await importTable(prisma.messages, 'messages', tempDb, mode);
     }
     if (selected.dokumente) {
       await importTable(prisma.documents, 'documents', tempDb, mode);
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
       await importTable(prisma.images, 'images', tempDb, mode);
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
       await importTable(prisma.feedback, 'feedback', tempDb, mode);
     }
     if (selected.dashboard) {
       const tables = ['article_views', 'page_views', 'daily_question_stats', 'daily_unanswered_stats', 'question_analysis_cache', 'token_usage', 'user_sessions', 'chat_interactions'];
       for (const table of tables) {
         if (table === 'user_sessions') {
           await importTable(prisma.user_sessions, 'user_sessions', tempDb, mode);
           await importTable(prisma.chat_interactions, 'chat_interactions', tempDb, mode);
         } else {
           await importTable(prisma[table], table, tempDb, mode);
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