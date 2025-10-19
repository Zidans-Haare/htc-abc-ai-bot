const { describe, it, expect, beforeEach, afterEach, beforeAll } = require('@jest/globals');
const auth = require('../server/controllers/authController.cjs');
const bcrypt = require('bcryptjs');
const sinon = require('sinon');

// Mock db
const mockUsers = {};
jest.mock('../server/controllers/db.cjs', () => ({
  User: {
    deleteMany: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockImplementation((data) => {
      const user = { id: Object.keys(mockUsers).length + 1, username: data.data.username, password: data.data.password, role: data.data.role };
      mockUsers[data.data.username] = user;
      return Promise.resolve(user);
    }),
    findFirst: jest.fn().mockImplementation((query) => {
      const username = query.where?.username;
      return Promise.resolve(mockUsers[username] || null);
    })
  }
}));
const { User } = require('../server/controllers/db.cjs');

describe('Auth Utils', () => {
  let clock;

  beforeAll(async () => {
    // Clean test user
    await User.deleteMany({ where: { username: 'testuser' } });
  });

  beforeEach(() => {
    clock = sinon.useFakeTimers({ now: new Date('2025-10-16') });
  });
  afterEach(() => {
    clock.restore();
  });

  it('creates user correctly', async () => {
    const user = await auth.createUser('testuser', 'weakpass123', 'user');
    expect(user.username).toBe('testuser');
    expect(user.role).toBe('user');
  });

  it('verifies valid user', async () => {
    // First create the user
    await auth.createUser('testuser2', 'weakpass123', 'user');
    const verified = await auth.verifyUser('testuser2', 'weakpass123');
    expect(verified.role).toBe('user');
  });

  it('rejects invalid user', async () => {
    const verified = await auth.verifyUser('fake', 'pass');
    expect(verified).toBe(null);
  });

  // Pitfalls: Test session expiry, but since DB, hard for unit.
});