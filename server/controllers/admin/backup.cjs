const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const upload = multer({ dest: 'temp/' });

const BACKUP_PATH = process.env.BACKUP_PATH || 'backups';
let backupInProgress = false;

module.exports = (adminAuth) => {
  // Ensure backup dir exists
  fs.mkdir(BACKUP_PATH, { recursive: true }).catch(() => {});

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
          const unanswered = await fs.readFile('ai_fragen/offene_fragen.txt', 'utf8');
          archive.append(unanswered, { name: 'offene_fragen.txt' });
        } catch {}
        try {
          const faq = await fs.readFile('ai_input/faq.txt', 'utf8');
          archive.append(faq, { name: 'faq.txt' });
        } catch {}
      }
      if (options.conversations) {
        const convs = await prisma.conversations.findMany({ include: { messages: true } });
        archive.append(JSON.stringify(convs, null, 2), { name: 'conversations.json' });
      }
      if (options.dokumente) {
        const docs = await prisma.documents.findMany();
        archive.append(JSON.stringify(docs, null, 2), { name: 'documents.json' });
        // Add files
        for (const doc of docs) {
          try {
            archive.file(`public/documents/${doc.filepath}`, { name: `documents/${doc.filepath}` });
          } catch {}
        }
      }
      if (options.bilder) {
        const imgs = await prisma.images.findMany();
        archive.append(JSON.stringify(imgs, null, 2), { name: 'images.json' });
        // Add files
        for (const img of imgs) {
          try {
            archive.file(`public/assets/images/${img.filename}`, { name: `images/${img.filename}` });
          } catch {}
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
        const tokenUsage = await prisma.token_usage.findMany();
        archive.append(JSON.stringify(tokenUsage, null, 2), { name: 'token_usage.json' });
        const userSessions = await prisma.user_sessions.findMany({ include: { chat_interactions: true } });
        archive.append(JSON.stringify(userSessions, null, 2), { name: 'user_sessions.json' });
      }

      await archive.finalize();
      console.log(`Backup ${filename} completed`);
    } catch (err) {
      console.error('Backup creation failed', err);
    } finally {
      backupInProgress = false;
    }
  }

  router.get('/list', adminAuth, async (req, res) => {
    try {
      const files = await fs.readdir(BACKUP_PATH);
      const backups = [];
      for (const file of files) {
        if (file.endsWith('.zip')) {
          const stat = await fs.stat(path.join(BACKUP_PATH, file));
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
      await fs.unlink(path.join(BACKUP_PATH, filename));
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
      await fs.rename(path.join(BACKUP_PATH, filename), path.join(BACKUP_PATH, newName));
      res.json({ success: true });
    } catch (err) {
      console.error('Rename backup failed', err);
      res.status(500).json({ error: 'Rename backup failed' });
    }
  });

  router.post('/upload', adminAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = req.file.originalname;
    const dest = path.join(BACKUP_PATH, filename);
    await fs.rename(req.file.path, dest);
    res.json({ filename });
  });

  router.post('/:filename/import', adminAuth, async (req, res) => {
    const { filename } = req.params;
    const { mode } = req.body; // 'replace', 'append-override', 'append-keep'
    const filepath = path.join(BACKUP_PATH, filename);
    try {
      const directory = await unzipper.Open.file(filepath);
      const files = {};
      for (const file of directory.files) {
        if (file.type === 'File') {
          const content = await file.buffer();
          if (file.path.endsWith('.json')) {
            files[file.path] = JSON.parse(content.toString());
          } else {
            // For files, save temporarily
            const tempPath = path.join('temp', file.path);
            await fs.mkdir(path.dirname(tempPath), { recursive: true });
            await fs.writeFile(tempPath, content);
          }
        }
      }

      // Import logic
      const importTable = async (table, data, replace) => {
        if (replace) await prisma[table].deleteMany();
        for (const item of data) {
          if (mode === 'append-keep' && await prisma[table].findUnique({ where: { id: item.id } })) continue;
          await prisma[table].upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      };

      if (files['users.json']) await importTable('users', files['users.json'], mode === 'replace');
      if (files['hochschuhl_abc.json']) await importTable('hochschuhl_abc', files['hochschuhl_abc.json'], mode === 'replace');
      if (files['questions.json']) await importTable('questions', files['questions.json'], mode === 'replace');
      if (files['conversations.json']) {
        for (const conv of files['conversations.json']) {
          const { messages, ...convData } = conv;
          const newConv = await prisma.conversations.upsert({
            where: { id: conv.id },
            update: convData,
            create: convData
          });
          for (const msg of messages) {
            await prisma.messages.upsert({
              where: { id: msg.id },
              update: { ...msg, conversation_id: newConv.id },
              create: { ...msg, conversation_id: newConv.id }
            });
          }
        }
      }
      if (files['documents.json']) {
        await importTable('documents', files['documents.json'], mode === 'replace');
        // Copy files
        for (const doc of files['documents.json']) {
          const src = path.join('temp', 'documents', doc.filepath);
          const dest = path.join('public', 'documents', doc.filepath);
          try {
            await fs.mkdir(path.dirname(dest), { recursive: true });
            await fs.copyFile(src, dest);
          } catch {}
        }
      }
      if (files['images.json']) {
        await importTable('images', files['images.json'], mode === 'replace');
        // Copy files
        for (const img of files['images.json']) {
          const src = path.join('temp', 'images', img.filename);
          const dest = path.join('public', 'assets', 'images', img.filename);
          try {
            await fs.mkdir(path.dirname(dest), { recursive: true });
            await fs.copyFile(src, dest);
          } catch {}
        }
      }
      if (files['feedback.json']) await importTable('feedback', files['feedback.json'], mode === 'replace');
      if (files['article_views.json']) await importTable('article_views', files['article_views.json'], mode === 'replace');
      if (files['page_views.json']) await importTable('page_views', files['page_views.json'], mode === 'replace');
      if (files['daily_question_stats.json']) await importTable('daily_question_stats', files['daily_question_stats.json'], mode === 'replace');
      if (files['token_usage.json']) await importTable('token_usage', files['token_usage.json'], mode === 'replace');
      if (files['user_sessions.json']) {
        for (const sess of files['user_sessions.json']) {
          const { chat_interactions, ...sessData } = sess;
          const newSess = await prisma.user_sessions.upsert({
            where: { session_id: sess.session_id },
            update: sessData,
            create: sessData
          });
          for (const inter of chat_interactions) {
            await prisma.chat_interactions.upsert({
              where: { id: inter.id },
              update: { ...inter, session_id: newSess.session_id },
              create: { ...inter, session_id: newSess.session_id }
            });
          }
        }
      }

      // Clean temp
      await fs.rm('temp', { recursive: true, force: true });

      res.json({ success: true });
    } catch (err) {
      console.error('Import failed', err);
      res.status(500).json({ error: 'Import failed' });
    }
  });

  return router;
};