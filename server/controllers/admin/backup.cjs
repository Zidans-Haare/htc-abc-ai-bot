const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const multer = require('multer');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const upload = multer({ dest: 'temp/' });

const BACKUP_PATH = path.resolve(__dirname, '..', '..', '..', process.env.BACKUP_PATH || 'backups');
let backupInProgress = false;

async function getSchemaHash() {
  const schemaPath = path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma');
  const schemaContent = await fsPromises.readFile(schemaPath, 'utf8');
  return crypto.createHash('sha256').update(schemaContent).digest('hex');
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
    try {
      await createBackup({ users, artikels, fragen, conversations, dokumente, bilder, feedback, dashboard }, filename);
      res.json({ filename, status: 'completed', message: 'Backup created successfully.' });
    } catch (err) {
      backupInProgress = false;
      res.status(500).json({ error: 'Backup failed' });
    }
    backupInProgress = false;
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

      // Export data as JSON
      if (options.users) {
        const data = await prisma.users.findMany();
        console.log(`Backing up ${data.length} users`);
        archive.append(JSON.stringify(data, null, 2), { name: 'users.json' });
      }
      if (options.artikels) {
        const data = await prisma.hochschuhl_abc.findMany();
        console.log(`Backing up ${data.length} artikels`);
        archive.append(JSON.stringify(data, null, 2), { name: 'hochschuhl_abc.json' });
      }
      if (options.fragen) {
        const data = await prisma.questions.findMany();
        console.log(`Backing up ${data.length} fragen`);
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
        const convs = await prisma.conversations.findMany();
        console.log(`Backing up ${convs.length} conversations`);
        archive.append(JSON.stringify(convs, null, 2), { name: 'conversations.json' });
        const msgs = await prisma.messages.findMany();
        console.log(`Backing up ${msgs.length} messages`);
        archive.append(JSON.stringify(msgs, null, 2), { name: 'messages.json' });
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
        const data = await prisma.images.findMany();
        console.log(`Backing up ${data.length} bilder`);
        archive.append(JSON.stringify(data, null, 2), { name: 'images.json' });
        // Add files
        for (const img of data) {
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
        archive.append(JSON.stringify(data, null, 2), { name: 'feedback.json' });
      }
      if (options.dashboard) {
        const tables = ['article_views', 'page_views', 'daily_question_stats', 'daily_unanswered_stats', 'question_analysis_cache', 'token_usage', 'user_sessions', 'chat_interactions'];
        for (const table of tables) {
          const data = await prisma[table].findMany();
          console.log(`Backing up ${data.length} ${table}`);
          archive.append(JSON.stringify(data, null, 2), { name: `${table}.json` });
        }
      }

      archive.finalize();
      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
      });
    } catch (err) {
      console.error('Backup creation failed', err);
      throw err;
    }
  }

  router.get('/list', adminAuth, async (req, res) => {
    try {
      const files = await fsPromises.readdir(BACKUP_PATH);
      const backupFiles = files.filter(f => f.endsWith('.zip')).map(f => {
        const filepath = path.join(BACKUP_PATH, f);
        const stats = fs.statSync(filepath);
        return { filename: f, size: stats.size, date: stats.mtime };
      }).sort((a, b) => b.date - a.date); // Sort newest first
      res.json(backupFiles);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list backup files' });
    }
  });

  router.get('/:filename', adminAuth, (req, res) => {
    const { filename } = req.params;
    const filepath = path.join(BACKUP_PATH, filename);
    res.download(filepath);
  });

  router.post('/upload', adminAuth, upload.single('backup'), async (req, res) => {
    const tempPath = req.file.path;
    const destPath = path.join(BACKUP_PATH, req.file.originalname);
    await fsPromises.rename(tempPath, destPath);
    res.json({ success: true });
  });

  router.put('/:filename/rename', adminAuth, async (req, res) => {
    const { filename } = req.params;
    const { newName } = req.body;
    const oldPath = path.join(BACKUP_PATH, filename);
    const newPath = path.join(BACKUP_PATH, newName);
    await fsPromises.rename(oldPath, newPath);
    res.json({ success: true });
  });

  router.delete('/:filename', adminAuth, async (req, res) => {
    const { filename } = req.params;
    const filepath = path.join(BACKUP_PATH, filename);
    await fsPromises.unlink(filepath);
    res.json({ success: true });
  });

  router.get('/:filename/files', adminAuth, async (req, res) => {
    const { filename } = req.params;
    const filepath = path.join(BACKUP_PATH, filename);
    try {
      const files = [];
      const zip = fs.createReadStream(filepath).pipe(unzipper.Parse({ forceStream: true }));
      for await (const entry of zip) {
        const fileName = entry.path;
        if (fileName.endsWith('.json')) {
          files.push(fileName.replace('.json', ''));
        }
        entry.autodrain();
      }
      res.json({ files });
    } catch (err) {
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  router.post('/:filename/import', adminAuth, async (req, res) => {
    console.log(`Import route called for ${req.params.filename}`);
    const { filename } = req.params;
    const { mode, selected } = req.body;
    console.log(`Import mode: ${mode}, selected: ${JSON.stringify(selected)}`);
    const filepath = path.join(BACKUP_PATH, filename);
    console.log(`Backup filepath: ${filepath}`);
     try {
       // Extract
       const extractPath = path.join(__dirname, '..', '..', '..', 'temp');
       // Clean up any existing temp directory
       try {
         await fsPromises.rm(extractPath, { recursive: true, force: true });
       } catch {}
       await fsPromises.mkdir(extractPath, { recursive: true });
      await new Promise((resolve, reject) => {
        fs.createReadStream(filepath)
          .pipe(unzipper.Extract({ path: extractPath }))
          .on('close', resolve)
          .on('error', reject);
      });
      console.log('Backup extracted successfully');
      // Read schema hash
      let backupSchemaHash;
      try {
        backupSchemaHash = await fsPromises.readFile(path.join(extractPath, 'schema-hash.txt'), 'utf8');
      } catch {}
      const currentSchemaHash = await getSchemaHash();
      if (backupSchemaHash && backupSchemaHash !== currentSchemaHash) {
        console.warn(`Schema mismatch: backup hash ${backupSchemaHash}, current hash ${currentSchemaHash}. Import may fail or require manual migration.`);
      }
      // Convert function
      function convertFromJSON(item, tableName) {
        const result = { ...item };
        const dateFields = {
          users: ['created_at', 'updated_at'],
          hochschuhl_abc: ['archived', 'created_at', 'updated_at'],
          questions: ['answered_at', 'created_at', 'updated_at'],
          conversations: ['created_at', 'updated_at'],
          messages: ['created_at', 'updated_at'],
          feedback: ['submitted_at', 'created_at', 'updated_at'],
          documents: ['uploaded_at', 'created_at', 'updated_at'],
          images: ['created_at', 'updated_at'],
          article_views: ['viewed_at', 'created_at', 'updated_at'],
          page_views: ['timestamp', 'created_at', 'updated_at'],
          daily_question_stats: ['created_at', 'updated_at'],
          daily_unanswered_stats: ['created_at', 'updated_at'],
          question_analysis_cache: ['created_at', 'updated_at'],
          token_usage: ['timestamp', 'created_at', 'updated_at'],
          user_sessions: ['started_at', 'last_activity', 'ended_at', 'created_at', 'updated_at'],
          chat_interactions: ['timestamp', 'created_at', 'updated_at']
        };
        if (dateFields[tableName]) {
          for (const field of dateFields[tableName]) {
            if (result[field] && typeof result[field] === 'string') {
              result[field] = new Date(result[field]);
            }
          }
        }
        return result;
      }
      async function importTable(prismaModel, tableName, data, mode, whereKey = 'id') {
        console.log(`Importing ${data.length} ${tableName} records`);
        if (mode === 'replace') await prismaModel.deleteMany();
        let processed = 0;
        for (const item of data) {
          if (mode === 'append-keep') {
            const existing = await prismaModel.findUnique({ where: { [whereKey]: item[whereKey] } });
            if (existing) continue;
          }
          const transformed = convertFromJSON(item, tableName);
          await prismaModel.upsert({
            where: { [whereKey]: item[whereKey] },
            update: transformed,
            create: transformed
          });
          processed++;
        }
        console.log(`Successfully imported ${processed} ${tableName} records`);
      }
      console.log('Starting data import');
      // Import
      if (selected.users) {
        try {
          const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'users.json'), 'utf8'));
          await importTable(prisma.users, 'users', data, mode);
        } catch (err) {
          console.log(`Failed to import users: ${err.message}`);
        }
      }
      if (selected.artikels) {
        try {
          const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'hochschuhl_abc.json'), 'utf8'));
          await importTable(prisma.hochschuhl_abc, 'hochschuhl_abc', data, mode);
        } catch (err) {
          console.log(`Failed to import artikels: ${err.message}`);
        }
      }
      if (selected.fragen) {
        try {
          const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'questions.json'), 'utf8'));
          await importTable(prisma.questions, 'questions', data, mode);
        } catch (err) {
          console.log(`Failed to import fragen: ${err.message}`);
        }
      }
      if (selected.conversations) {
        try {
          const convs = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'conversations.json'), 'utf8'));
          await importTable(prisma.conversations, 'conversations', convs, mode);
          const msgs = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'messages.json'), 'utf8'));
          await importTable(prisma.messages, 'messages', msgs, mode);
        } catch (err) {
          console.log(`Failed to import conversations: ${err.message}`);
        }
      }
      if (selected.dokumente) {
        try {
          const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'documents.json'), 'utf8'));
          await importTable(prisma.documents, 'documents', data, mode);
          // Handle files
          const docDir = path.join('uploads', 'documents');
          if (mode === 'replace') {
            try {
              await fsPromises.rm(docDir, { recursive: true, force: true });
            } catch (err) {}
          }
          console.log(`Copying ${data.length} document files`);
          let copied = 0;
          for (const doc of data) {
            const src = path.join(extractPath, 'documents', doc.filepath);
            const dest = path.join(docDir, doc.filepath);
            try {
              await fsPromises.mkdir(path.dirname(dest), { recursive: true });
              await fsPromises.copyFile(src, dest);
              copied++;
            } catch (err) {
              console.log(`Failed to copy document ${doc.filepath}: ${err.message}`);
            }
          }
          console.log(`Successfully copied ${copied} document files`);
        } catch (err) {
          console.log(`Failed to import dokumente: ${err.message}`);
        }
      }
      if (selected.bilder) {
        try {
          const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'images.json'), 'utf8'));
          await importTable(prisma.images, 'images', data, mode);
          // Handle files
          const imgDir = path.join('uploads', 'images');
          if (mode === 'replace') {
            try {
              await fsPromises.rm(imgDir, { recursive: true, force: true });
            } catch (err) {}
          }
          console.log(`Copying ${data.length} image files`);
          let copied = 0;
          for (const img of data) {
            const src = path.join(extractPath, 'images', img.filename);
            const dest = path.join(imgDir, img.filename);
            try {
              await fsPromises.mkdir(path.dirname(dest), { recursive: true });
              await fsPromises.copyFile(src, dest);
              copied++;
            } catch (err) {
              console.log(`Failed to copy image ${img.filename}: ${err.message}`);
            }
          }
          console.log(`Successfully copied ${copied} image files`);
        } catch (err) {
          console.log(`Failed to import bilder: ${err.message}`);
        }
      }
      if (selected.feedback) {
        try {
          const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'feedback.json'), 'utf8'));
          await importTable(prisma.feedback, 'feedback', data, mode);
        } catch (err) {
          console.log(`Failed to import feedback: ${err.message}`);
        }
      }
      if (selected.dashboard) {
        const tables = ['article_views', 'page_views', 'daily_question_stats', 'daily_unanswered_stats', 'question_analysis_cache', 'token_usage', 'user_sessions', 'chat_interactions'];
        for (const table of tables) {
          try {
            const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, `${table}.json`), 'utf8'));
            if (table === 'user_sessions') {
              await importTable(prisma.user_sessions, 'user_sessions', data, mode, 'session_id');
            } else {
              await importTable(prisma[table], table, data, mode);
            }
          } catch (err) {
            console.log(`Failed to import ${table}: ${err.message}`);
          }
        }
      }
      // Clean
      await fsPromises.rm(extractPath, { recursive: true, force: true });
      res.json({ success: true });
    } catch (err) {
      console.error('Import failed', err);
      res.status(500).json({ error: 'Import failed' });
    }
  });

  router.post('/import', adminAuth, upload.single('backup'), async (req, res) => {
    const { users, artikels, fragen, conversations, dokumente, bilder, feedback, dashboard } = req.body;
    const mode = req.body.mode || 'append-override';
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No backup file uploaded' });
    }
     try {
       // Extract
       const extractPath = path.join(__dirname, '..', '..', '..', 'temp');
       // Clean up any existing temp directory
       try {
         await fsPromises.rm(extractPath, { recursive: true, force: true });
       } catch {}
       await fsPromises.mkdir(extractPath, { recursive: true });
      await new Promise((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(unzipper.Extract({ path: extractPath }))
          .on('close', resolve)
          .on('error', reject);
      });
      // Read schema hash
      let backupSchemaHash;
      try {
        backupSchemaHash = await fsPromises.readFile(path.join(extractPath, 'schema-hash.txt'), 'utf8');
      } catch {}
      const currentSchemaHash = await getSchemaHash();
      if (backupSchemaHash && backupSchemaHash !== currentSchemaHash) {
        console.warn(`Schema mismatch: backup hash ${backupSchemaHash}, current hash ${currentSchemaHash}. Import may fail or require manual migration.`);
      }
      // Convert function
      function convertFromJSON(item, tableName) {
        const result = { ...item };
        const dateFields = {
          users: ['created_at', 'updated_at'],
          hochschuhl_abc: ['archived', 'created_at', 'updated_at'],
          questions: ['answered_at', 'created_at', 'updated_at'],
          conversations: ['created_at', 'updated_at'],
          messages: ['created_at', 'updated_at'],
          feedback: ['submitted_at', 'created_at', 'updated_at'],
          documents: ['uploaded_at', 'created_at', 'updated_at'],
          images: ['created_at', 'updated_at'],
          article_views: ['viewed_at', 'created_at', 'updated_at'],
          page_views: ['timestamp', 'created_at', 'updated_at'],
          daily_question_stats: ['created_at', 'updated_at'],
          daily_unanswered_stats: ['created_at', 'updated_at'],
          question_analysis_cache: ['created_at', 'updated_at'],
          token_usage: ['timestamp', 'created_at', 'updated_at'],
          user_sessions: ['started_at', 'last_activity', 'ended_at', 'created_at', 'updated_at'],
          chat_interactions: ['timestamp', 'created_at', 'updated_at']
        };
        if (dateFields[tableName]) {
          for (const field of dateFields[tableName]) {
            if (result[field] && typeof result[field] === 'string') {
              result[field] = new Date(result[field]);
            }
          }
        }
        return result;
      }
      async function importTable(prismaModel, tableName, data, mode, whereKey = 'id') {
        console.log(`Importing ${data.length} ${tableName} records`);
        if (mode === 'replace') await prismaModel.deleteMany();
        let processed = 0;
        for (const item of data) {
          if (mode === 'append-keep') {
            const existing = await prismaModel.findUnique({ where: { [whereKey]: item[whereKey] } });
            if (existing) continue;
          }
          const transformed = convertFromJSON(item, tableName);
          await prismaModel.upsert({
            where: { [whereKey]: item[whereKey] },
            update: transformed,
            create: transformed
          });
          processed++;
        }
        console.log(`Successfully imported ${processed} ${tableName} records`);
      }
      // Transfer data from JSON files
      if (users) {
        const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'users.json'), 'utf8'));
        await importTable(prisma.users, 'users', data, mode);
      }
      if (artikels) {
        const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'hochschuhl_abc.json'), 'utf8'));
        await importTable(prisma.hochschuhl_abc, 'hochschuhl_abc', data, mode);
      }
      if (fragen) {
        const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'questions.json'), 'utf8'));
        await importTable(prisma.questions, 'questions', data, mode);
      }
      if (conversations) {
        const convs = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'conversations.json'), 'utf8'));
        await importTable(prisma.conversations, 'conversations', convs, mode);
        const msgs = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'messages.json'), 'utf8'));
        await importTable(prisma.messages, 'messages', msgs, mode);
      }
      if (dokumente) {
        const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, 'documents.json'), 'utf8'));
        await importTable(prisma.documents, 'documents', data, mode);
        // Handle files
        const docDir = path.join('uploads', 'documents');
        if (mode === 'replace') {
          try {
            await fsPromises.rm(docDir, { recursive: true, force: true });
          } catch (err) {}
        }
        console.log(`Copying ${data.length} document files`);
        let copied = 0;
        for (const doc of data) {
          const src = path.join('temp', 'documents', doc.filepath);
          const dest = path.join(docDir, doc.filepath);
          try {
            await fsPromises.mkdir(path.dirname(dest), { recursive: true });
            await fsPromises.copyFile(src, dest);
            copied++;
          } catch (err) {
            console.log(`Failed to copy document ${doc.filepath}: ${err.message}`);
          }
        }
        console.log(`Successfully copied ${copied} document files`);
      }
      if (bilder) {
        const data = JSON.parse(await fsPromises.readFile(path.join('temp', 'images.json'), 'utf8'));
        await importTable(prisma.images, 'images', data, mode);
        // Handle files
        const imgDir = path.join('uploads', 'images');
        if (mode === 'replace') {
          try {
            await fsPromises.rm(imgDir, { recursive: true, force: true });
          } catch (err) {}
        }
        console.log(`Copying ${data.length} image files`);
        let copied = 0;
        for (const img of data) {
          const src = path.join('temp', 'images', img.filename);
          const dest = path.join(imgDir, img.filename);
          try {
            await fsPromises.mkdir(path.dirname(dest), { recursive: true });
            await fsPromises.copyFile(src, dest);
            copied++;
          } catch (err) {
            console.log(`Failed to copy image ${img.filename}: ${err.message}`);
          }
        }
        console.log(`Successfully copied ${copied} image files`);
      }
      if (feedback) {
        const data = JSON.parse(await fsPromises.readFile(path.join('temp', 'feedback.json'), 'utf8'));
        await importTable(prisma.feedback, 'feedback', data, mode);
      }
      if (dashboard) {
        const tables = ['article_views', 'page_views', 'daily_question_stats', 'daily_unanswered_stats', 'question_analysis_cache', 'token_usage', 'user_sessions', 'chat_interactions'];
        for (const table of tables) {
          const data = JSON.parse(await fsPromises.readFile(path.join('temp', `${table}.json`), 'utf8'));
          if (table === 'user_sessions') {
            await importTable(prisma.user_sessions, 'user_sessions', data, mode, 'session_id');
          } else {
            await importTable(prisma[table], table, data, mode);
          }
        }
      }
      // Clean temp
      await fsPromises.rm(extractPath, { recursive: true, force: true });
      await fsPromises.unlink(file.path);
      res.json({ success: true });
    } catch (err) {
      console.error('Import failed', err);
      res.status(500).json({ error: 'Import failed' });
    }
  });

  return router;
};