const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const multer = require('multer');
const unzipper = require('unzipper');
const { logger } = require('./backupUtils');
const { createBackup } = require('./backupExporter');
const { importBackup } = require('./backupImporter');

const upload = multer({ dest: 'temp/' });
const BACKUP_PATH = path.resolve(__dirname, '..', '..', '..', process.env.BACKUP_PATH || 'backups');
let backupInProgress = false;

module.exports = (adminAuth) => {
  // Ensure backup dir exists
  fsPromises.mkdir(BACKUP_PATH, { recursive: true }).catch(() => {});

  router.post('/create', adminAuth, async (req, res) => {
    if (backupInProgress) {
      return res.status(409).json({ error: 'Backup already in progress' });
    }

    const options = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.zip`;

    backupInProgress = true;
    try {
      await createBackup(options, filename, BACKUP_PATH);
      res.json({ filename, status: 'completed', message: 'Backup created successfully.' });
    } catch (err) {
      logger.error('Backup creation failed', err);
      res.status(500).json({ error: 'Backup failed' });
    } finally {
      backupInProgress = false;
    }
  });

  router.get('/list', adminAuth, async (req, res) => {
    try {
      const files = await fsPromises.readdir(BACKUP_PATH);
      const backupFiles = files.filter(f => f.endsWith('.zip')).map(f => {
        const filepath = path.join(BACKUP_PATH, f);
        const stats = fs.statSync(filepath);
        return { filename: f, size: stats.size, date: stats.mtime };
      }).sort((a, b) => b.date - a.date);
      res.json(backupFiles);
    } catch (err) {
      logger.error('Failed to list backup files', err);
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
    try {
      await fsPromises.rename(tempPath, destPath);
      res.json({ success: true });
    } catch (err) {
      logger.error('Upload failed', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  router.put('/:filename/rename', adminAuth, async (req, res) => {
    const { filename } = req.params;
    const { newName } = req.body;
    const oldPath = path.join(BACKUP_PATH, filename);
    const newPath = path.join(BACKUP_PATH, newName);
    try {
      await fsPromises.rename(oldPath, newPath);
      res.json({ success: true });
    } catch (err) {
      logger.error('Rename failed', err);
      res.status(500).json({ error: 'Rename failed' });
    }
  });

  router.delete('/:filename', adminAuth, async (req, res) => {
    const { filename } = req.params;
    const filepath = path.join(BACKUP_PATH, filename);
    try {
      await fsPromises.unlink(filepath);
      res.json({ success: true });
    } catch (err) {
      logger.error('Delete failed', err);
      res.status(500).json({ error: 'Delete failed' });
    }
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
      logger.error('Failed to list files', err);
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  router.post('/:filename/import', adminAuth, async (req, res) => {
    const { filename } = req.params;
    const { mode, selected } = req.body;
    const filepath = path.join(BACKUP_PATH, filename);
    try {
      await importBackup(selected, mode, filepath);
      res.json({ success: true });
    } catch (err) {
      logger.error('Import failed', err);
      res.status(500).json({ error: 'Import failed' });
    }
  });

  router.post('/import', adminAuth, upload.single('backup'), async (req, res) => {
    const { users, artikels, fragen, conversations, dokumente, bilder, feedback, dashboard } = req.body;
    const mode = 'replace'; // Hardcoded to replace-only
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No backup file uploaded' });
    }
    try {
      await importBackup({ users, artikels, fragen, conversations, dokumente, bilder, feedback, dashboard }, mode, file.path);
      await fsPromises.unlink(file.path);
      res.json({ success: true });
    } catch (err) {
      logger.error('Import failed', err);
      await fsPromises.unlink(file.path).catch(() => {});
      res.status(500).json({ error: 'Import failed' });
    }
  });

  return router;
};