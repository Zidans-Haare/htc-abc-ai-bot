const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const { PrismaClient } = require('@prisma/client');
const { logger, getSchemaHash } = require('./backupUtils');
const { tableMappings, fileMappings } = require('./backupConfig');

const prisma = new PrismaClient();

async function createBackup(options, filename, backupPath) {
  const filepath = path.join(backupPath, filename);
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
    for (const [key, table] of Object.entries(tableMappings)) {
      if (options[key]) {
        if (Array.isArray(table)) {
          for (const t of table) {
            const data = await prisma[t].findMany();
            logger.info(`Backing up ${data.length} ${t} records`);
            archive.append(JSON.stringify(data, null, 2), { name: `${t}.json` });
          }
        } else {
          const data = await prisma[table].findMany();
          logger.info(`Backing up ${data.length} ${table} records`);
          archive.append(JSON.stringify(data, null, 2), { name: `${table}.json` });
        }
      }
    }

    // Add extra files
    for (const [key, files] of Object.entries(fileMappings)) {
      if (options[key]) {
        if (Array.isArray(files)) {
          for (const file of files) {
            try {
              const content = await fsPromises.readFile(file, 'utf8');
              archive.append(content, { name: path.basename(file) });
            } catch (err) {
              logger.warn(`Failed to add file ${file}: ${err.message}`);
            }
          }
        } else {
          // Handle document/image files
          const data = await prisma[tableMappings[key]].findMany();
          for (const item of data) {
            const filePath = `uploads/${files}/${item.filename || item.filepath}`;
            if (fs.existsSync(filePath)) {
              try {
                archive.file(filePath, { name: `${files}/${item.filename || item.filepath}` });
                logger.info(`Added ${files} file: ${item.filename || item.filepath}`);
              } catch (err) {
                logger.error(`Failed to add ${files} file: ${err.message}`);
              }
            } else {
              logger.warn(`${files} file not found: ${filePath}`);
            }
          }
        }
      }
    }

    archive.finalize();
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });
    logger.info(`Backup created: ${filename}`);
  } catch (err) {
    logger.error('Backup creation failed', err);
    throw err;
  }
}

module.exports = {
  createBackup
};