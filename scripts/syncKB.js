const dotenv = require('dotenv');
dotenv.config();

const vectorStore = require('../lib/vectorStore');

async function main() {
  try {
    await vectorStore.syncFromDB();
    console.log('Sync completed successfully');
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { syncKB: vectorStore.syncFromDB };