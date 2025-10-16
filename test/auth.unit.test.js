const { describe, it, expect, beforeEach, afterEach, beforeAll } = require('@jest/globals');
const auth = require('../controllers/authController.cjs');
const bcrypt = require('bcryptjs');
const sinon = require('sinon');
const { User } = require('../controllers/db.cjs');

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
    // Test verifyUser
    const verified = await auth.verifyUser('testuser', 'weakpass123');
    expect(verified.username).toBe('testuser');
  });

  it('verifies valid user', async () => {
    const verified = await auth.verifyUser('testuser', 'weakpass123');
    expect(verified.role).toBe('user');
  });

  it('rejects invalid user', async () => {
    const verified = await auth.verifyUser('fake', 'pass');
    expect(verified).toBe(null);
  });

  // Pitfalls: Test session expiry, but since DB, hard for unit.
});