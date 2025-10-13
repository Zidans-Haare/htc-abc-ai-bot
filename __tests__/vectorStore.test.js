jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(() => Promise.resolve({}))
}));

jest.mock('@langchain/community/vectorstores/chroma', () => ({
  Chroma: jest.fn()
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid')
}));

jest.mock('../controllers/db.cjs', () => ({
  HochschuhlABC: {
    findAll: jest.fn(() => Promise.resolve([]))
  }
}));

const vsm = require('../lib/vectorStore');

describe('VectorStoreManager', () => {
  test('should initialize with embeddings', () => {
    expect(vsm.embeddings).toBeDefined();
  });

  test('should have lastSync date', () => {
    expect(vsm.lastSync).toBeInstanceOf(Date);
  });

  // Additional tests can be added with more mocks
});