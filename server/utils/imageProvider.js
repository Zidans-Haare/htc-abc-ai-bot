const { Images } = require('../controllers/db.cjs');
const vectorStore = require('../lib/vectorStore.js');

/**
 * Parses an image chunk to extract filename and description.
 * Assumes chunk format: "Image: filename - description"
 */
function parseImageFromChunk(chunk) {
  const match = chunk.match(/Image:\s*([^-\n]+)\s*-\s*(.+)/);
  if (match) {
    const filename = match[1].trim();
    const description = match[2].trim();
    return `image_name: ${filename} description: ${description}`;
  }
  return null; // Invalid chunk
}

/**
 * Gets the image list based on mode.
 * @param {Object} options - { mode: 'static'|'simple'|'dynamic', query: string (for dynamic) }
 * @returns {Promise<string>} Formatted image list
 */
async function getImageList(options = {}) {
  const { mode = 'static', query = '' } = options;

  if (mode === 'dynamic' && query) {
    // Dynamic: Query vector DB for relevant images based on user query
    try {
      const chunks = await vectorStore.getImageChunks(query, 10); // Top 10 relevant
      const parsed = chunks.map(parseImageFromChunk).filter(Boolean);
      return parsed.join('\n\n');
    } catch (error) {
      console.error('Error in dynamic image mode:', error);
      return await getImageList({ mode: 'static' }); // Fallback
    }
  } else if (mode === 'simple') {
    // Simple vector: Get all image chunks from vector DB
    try {
      const chunks = await vectorStore.getImageChunks('', 100); // Broad query for all
      const parsed = chunks.map(parseImageFromChunk).filter(Boolean);
      return parsed.join('\n\n');
    } catch (error) {
      console.error('Error in simple vector mode:', error);
      return await getImageList({ mode: 'static' }); // Fallback
    }
  } else {
    // Static: Default Prisma fetch
    const images = await Images.findMany({
      select: { filename: true, description: true },
    });
    return images
      .map(image => `image_name: ${image.filename} description: ${image.description ? image.description.replace(/\n/g, ' ') : ''}`)
      .join('\n\n');
  }
}

module.exports = { getImageList };