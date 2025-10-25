const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const winston = require('winston');

// Setup logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'logs/backup.log' })
  ]
});

async function getSchemaHash() {
  const schemaPath = path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma');
  const schemaContent = await fsPromises.readFile(schemaPath, 'utf8');
  return crypto.createHash('sha256').update(schemaContent).digest('hex');
}

function convertFromJSON(item, tableName, dateFields) {
  const result = { ...item };
  if (dateFields[tableName]) {
    for (const field of dateFields[tableName]) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = new Date(result[field]);
      }
    }
  }
  return result;
}

async function copyFiles(files, srcDir, destDir, mode) {
  if (mode === 'replace') {
    try {
      await fsPromises.rm(destDir, { recursive: true, force: true });
    } catch (err) {
      logger.warn(`Failed to remove dest dir ${destDir}: ${err.message}`);
    }
  }
  let copied = 0;
  for (const file of files) {
    const src = path.join(srcDir, file);
    const dest = path.join(destDir, file);
    try {
      await fsPromises.mkdir(path.dirname(dest), { recursive: true });
      await fsPromises.copyFile(src, dest);
      copied++;
    } catch (err) {
      logger.error(`Failed to copy ${file}: ${err.message}`);
    }
  }
  return copied;
}

module.exports = {
  logger,
  getSchemaHash,
  convertFromJSON,
  copyFiles
};