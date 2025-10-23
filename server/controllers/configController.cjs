const { getConfig, getSection } = require('../../config');

const pickKeys = (obj, keys = []) => {
  if (!obj || typeof obj !== 'object') {
    return {};
  }
  return keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

const getUiConfig = (req, res) => {
  try {
    const branding = getSection('branding', {});
    const features = getSection('features', {});
    const contact = pickKeys(getSection('contact', {}), ['support_email', 'imprint_url', 'privacy_url']);
    const deployment = pickKeys(getSection('deployment', {}), ['domain']);
    const themes = pickKeys(getSection('themes', {}), ['chat_background_gradient', 'dashboard_theme']);

    res.json({
      branding,
      features,
      contact,
      deployment,
      themes,
    });
  } catch (error) {
    console.error('Failed to load UI configuration:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
};

const getServerConfig = (req, res) => {
  try {
    const storage = getSection('storage', {});
    const security = getSection('security', {});
    const database = getSection('database', {});
    const ai = pickKeys(getSection('ai', {}), [
      'provider',
      'model',
      'temperature',
      'max_tokens',
      'streaming',
    ]);

    res.json({
      storage,
      security,
      database,
      ai,
    });
  } catch (error) {
    console.error('Failed to load server configuration:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
};

module.exports = {
  getUiConfig,
  getServerConfig,
};

