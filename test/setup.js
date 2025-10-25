const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load main .env to get main DB URL
const mainEnv = {};
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), processEnv: mainEnv });
const mainDbUrl = mainEnv.DATABASE_URL;

// Load .env.test
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

// Fallback to .env for missing vars
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Safety check
const testDbUrl = process.env.BACKUP_TEST_DB_URL || 'file::memory:?cache=shared';

if (testDbUrl === mainDbUrl) {
  throw new Error('Unsafe: BACKUP_TEST_DB_URL matches main DATABASE_URL. Use a separate test DB.');
}

// Set test DB
process.env.DATABASE_URL = testDbUrl;
process.env.BACKUP_TEST_DB_URL = testDbUrl;

if (testDbUrl.includes(':memory:')) {
  console.warn('Using in-memory SQLite for tests. Restore tests will be skipped.');
}

// Ensure test DB file exists or is in-memory
if (!testDbUrl.includes(':memory:') && !fs.existsSync(testDbUrl.replace('file:', ''))) {
  // Create empty file for SQLite
  fs.writeFileSync(testDbUrl.replace('file:', ''), '');
}

global.sinon = require('sinon');