const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const unzipper = require('unzipper');
const { PrismaClient } = require('@prisma/client');
const { logger, getSchemaHash, convertFromJSON, copyFiles } = require('./backupUtils');
const { tableMappings, dateFields, fileMappings, whereKeys } = require('./backupConfig');

const prisma = new PrismaClient();

async function resetSequences(prisma) {
  const tables = [
    'hochschuhl_abc', 'questions', 'messages', 'feedback', 'documents', 'images',
    'article_views', 'page_views', 'daily_question_stats', 'daily_unanswered_stats', 'question_analysis_cache', 'token_usage', 'user_sessions', 'chat_interactions', 'users'
  ];
        for (const table of tables) {
          try {
            const result = await prisma.$queryRawUnsafe(`SELECT MAX(id) as max_id FROM ${table}`);
            const maxId = result[0]?.max_id || 0;
            if (typeof maxId === 'number' && maxId >= 0) {
              await prisma.$queryRawUnsafe(`ALTER SEQUENCE ${table}_id_seq RESTART WITH ${maxId + 1}`);
              logger.info(`Reset sequence for ${table} to ${maxId + 1}`);
            } else {
              logger.warn(`Skipped ${table}: invalid max_id ${maxId}`);
            }
          } catch (err) {
            logger.warn(`Failed to reset sequence for ${table}: ${err.message}`);
          }
        }
}

async function importTable(prismaModel, tableName, data, mode, whereKey = 'id') {
  logger.info(`Importing ${data.length} ${tableName} records`);
  if (mode === 'replace') {
    await prismaModel.deleteMany();
    // Bulk insert for replace mode
    const transformedData = data.map(item => convertFromJSON(item, tableName, dateFields));
    await prismaModel.createMany({ data: transformedData, skipDuplicates: true });
    logger.info(`Successfully bulk imported ${data.length} ${tableName} records`);
  } else {
    // Fallback for other modes (if needed), but dropping merging
    throw new Error('Only replace mode supported');
  }
}

async function importBackup(options, mode, zipPath) {
  const extractPath = path.join(__dirname, '..', '..', '..', 'temp');
  // Clean up any existing temp directory
  try {
    await fsPromises.rm(extractPath, { recursive: true, force: true });
  } catch {}
  await fsPromises.mkdir(extractPath, { recursive: true });

  try {
    // Extract
    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractPath }))
        .on('close', resolve)
        .on('error', reject);
    });
    logger.info('Backup extracted successfully');

    // Read schema hash
    let backupSchemaHash;
    try {
      backupSchemaHash = await fsPromises.readFile(path.join(extractPath, 'schema-hash.txt'), 'utf8');
    } catch {}
    const currentSchemaHash = await getSchemaHash();
    if (backupSchemaHash && backupSchemaHash !== currentSchemaHash) {
      logger.warn(`Schema mismatch: backup hash ${backupSchemaHash}, current hash ${currentSchemaHash}. Import may fail or require manual migration.`);
    }

    // Import data
    await prisma.$transaction(async (tx) => {
     // Import in dependency order: children first to avoid FK issues on delete
       const importOrder = [
         'hochschuhl_abc', 'questions', 'messages', 'conversations', 'feedback', 'documents', 'images',
         'article_views', 'page_views', 'daily_question_stats', 'daily_unanswered_stats', 'question_analysis_cache',
         'token_usage', 'chat_interactions', 'user_sessions', 'users'
       ];
      for (const tableName of importOrder) {
        const key = Object.keys(tableMappings).find(k => {
          const t = tableMappings[k];
          return Array.isArray(t) ? t.includes(tableName) : t === tableName;
        });
        if (key && options[key]) {
          try {
            const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, `${tableName}.json`), 'utf8'));
            await importTable(tx[tableName], tableName, data, mode, whereKeys[tableName] || 'id');
          } catch (err) {
            logger.error(`Failed to import ${tableName}: ${err.message}`);
          }
        }
      }

      // Handle files
      for (const [key, files] of Object.entries(fileMappings)) {
        if (options[key] && !Array.isArray(files)) {
          try {
            const data = JSON.parse(await fsPromises.readFile(path.join(extractPath, `${tableMappings[key]}.json`), 'utf8'));
            const destDir = path.join('uploads', files);
            const copied = await copyFiles(data.map(item => item.filename || item.filepath), path.join(extractPath, files), destDir, mode);
            logger.info(`Successfully copied ${copied} ${files} files`);
          } catch (err) {
            logger.error(`Failed to import ${key} files: ${err.message}`);
          }
        }
      }
    });

    // Reset auto-increment sequences for PostgreSQL
    if (process.env.DATABASE_URL.startsWith('postgres')) {
      await resetSequences(prisma);
    }

    // Clean
    await fsPromises.rm(extractPath, { recursive: true, force: true });
    logger.info('Import completed successfully');
  } catch (err) {
    logger.error('Import failed', err);
    throw err;
  }
}

module.exports = {
  importBackup
};