const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create a cache directory if it doesn't exist
const cacheDir = path.join(__dirname, '..', 'cache', 'uploads'); // Adjust path to root-level cache if needed
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

module.exports = (app) => {
  app.get('/uploads/:filename', async (req, res) => {
    const { filename } = req.params;
    const match = filename.match(/^(.+)_(\d+)px(\.\w+)?$/);
    if (!match) {
      // Serve original if no size specified
      return res.sendFile(path.join(__dirname, '..', 'public', 'uploads', filename), (err) => {
        if (err) res.status(404).send('Image not found');
      });
    }

    const [_, baseName, widthStr, ext] = match;
    const width = parseInt(widthStr, 10);
    const requestedExt = ext || '';
    const originalPath = path.join(__dirname, '..', 'public', 'uploads', `${baseName}${requestedExt}`);
    const cachePath = path.join(cacheDir, filename);

    if (!fs.existsSync(originalPath)) {
      return res.status(404).send('Original image not found');
    }

    // Check cache
    if (fs.existsSync(cachePath)) {
      return res.sendFile(cachePath);
    }

    try {
      // Get metadata to determine actual format
      const metadata = await sharp(originalPath).metadata();
      const originalFormat = metadata.format ? metadata.format.toLowerCase() : null;

      // Start sharp pipeline
      let imageSharp = sharp(originalPath).resize({ width });

      let outputFormat;

      switch (originalFormat) {
        case 'jpeg':
        case 'jpg':
          imageSharp = imageSharp.jpeg();
          outputFormat = 'jpeg';
          break;
        case 'png':
          imageSharp = imageSharp.png();
          outputFormat = 'png';
          break;
        case 'gif':
          imageSharp = imageSharp.gif();
          outputFormat = 'gif';
          break;
        case 'webp':
          imageSharp = imageSharp.webp();
          outputFormat = 'webp';
          break;
        case 'svg':
          imageSharp = imageSharp.png();
          outputFormat = 'png';
          break;
        default:
          // Fallback to JPEG for unsupported formats
          imageSharp = imageSharp.jpeg();
          outputFormat = 'jpeg';
      }

      const buffer = await imageSharp.toBuffer();

      // Cache the resized image
      fs.writeFileSync(cachePath, buffer);

      res.type(`image/${outputFormat}`);
      res.send(buffer);
    } catch (error) {
      console.error('Image resize error:', error);
      res.status(500).send('Error resizing image');
    }
  });
};