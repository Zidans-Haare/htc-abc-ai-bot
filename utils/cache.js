const fs = require('fs').promises;
const path = require('path');

const cache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

async function getCached(filePath) {
  const absolutePath = path.resolve(__dirname, '../', filePath);
  const cached = cache.get(absolutePath);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.content;
  }
  const content = await fs.readFile(absolutePath, 'utf8');
  cache.set(absolutePath, { content, timestamp: Date.now() });
  return content;
}

function clearCache(filePath) {
  const absolutePath = path.resolve(__dirname, '../', filePath);
  cache.delete(absolutePath);
}

function getCacheSize() {
  return cache.size;
}

module.exports = { getCached, clearCache, getCacheSize };