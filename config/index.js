const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DEFAULT_FILENAME = 'app.yml';
const EXAMPLE_FILENAME = 'app.example.yml';

let cachedConfig = null;
let cachedMtime = null;

const isPlainObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const deepMerge = (target, source) => {
  const output = { ...target };

  Object.keys(source || {}).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (Array.isArray(sourceValue)) {
      output[key] = Array.isArray(targetValue) ? [...targetValue, ...sourceValue] : [...sourceValue];
      return;
    }

    if (isPlainObject(sourceValue)) {
      output[key] = deepMerge(isPlainObject(targetValue) ? targetValue : {}, sourceValue);
      return;
    }

    output[key] = sourceValue;
  });

  return output;
};

const resolveConfigPath = () => {
  if (process.env.APP_CONFIG_PATH) {
    return path.resolve(process.cwd(), process.env.APP_CONFIG_PATH);
  }
  return path.resolve(__dirname, DEFAULT_FILENAME);
};

const resolveExamplePath = () => path.resolve(__dirname, EXAMPLE_FILENAME);

const loadYamlFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const fileContents = fs.readFileSync(filePath, 'utf8');
    if (!fileContents.trim()) {
      return {};
    }
    return yaml.load(fileContents) || {};
  } catch (err) {
    console.error(`Failed to read configuration from ${filePath}:`, err.message);
    throw err;
  }
};

const getFileMtime = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtimeMs;
  } catch (err) {
    return null;
  }
};

const loadConfig = () => {
  const configPath = resolveConfigPath();
  const examplePath = resolveExamplePath();

  const exampleConfig = loadYamlFile(examplePath);
  const userConfig = loadYamlFile(configPath);

  const merged = deepMerge(exampleConfig, userConfig);

  cachedConfig = {
    data: merged,
    path: configPath,
    examplePath,
  };
  cachedMtime = Math.max(
    getFileMtime(configPath) || 0,
    getFileMtime(examplePath) || 0,
  );

  return cachedConfig;
};

const ensureConfigLoaded = () => {
  if (!cachedConfig) {
    return loadConfig();
  }

  const configPath = cachedConfig.path;
  const examplePath = cachedConfig.examplePath;
  const latestMtime = Math.max(
    getFileMtime(configPath) || 0,
    getFileMtime(examplePath) || 0,
  );

  if (!cachedMtime || latestMtime > cachedMtime) {
    return loadConfig();
  }

  return cachedConfig;
};

const getConfig = () => ensureConfigLoaded().data;

const getSection = (sectionPath, fallback = undefined) => {
  const parts = Array.isArray(sectionPath)
    ? sectionPath
    : String(sectionPath).split('.').filter(Boolean);

  let current = getConfig();
  for (const part of parts) {
    if (current && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
    } else {
      return fallback;
    }
  }
  return current === undefined ? fallback : current;
};

const reloadConfig = () => loadConfig().data;

const ensureConfigFile = () => {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) {
    const examplePath = resolveExamplePath();
    fs.copyFileSync(examplePath, configPath);
  }
  return configPath;
};

module.exports = {
  getConfig,
  getSection,
  reloadConfig,
  ensureConfigFile,
  resolveConfigPath,
};

