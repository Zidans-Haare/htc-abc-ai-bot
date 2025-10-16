module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['**/*.js', '!**/node_modules/**', '!**/test/**'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testMatch: ['**/test/**/*.test.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@xenova|@huggingface)/)'
  ],
  moduleNameMapper: {
    '^../lib/vectorStore$': '<rootDir>/test/__mocks__/vectorStore.js'
  },
};