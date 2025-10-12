const { getSession, createSession, verifyUser, createUser, listUsers, updateUserPassword, deleteUser, cleanupExpiredSessions } = require('../controllers/authController.cjs');
const { User, AuthSession } = require('../controllers/db.cjs');
const bcrypt = require('bcryptjs');

// Mock the db module
jest.mock('../controllers/db.cjs', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  AuthSession: {
    create: jest.fn(),
    destroy: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('authController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a session successfully', async () => {
      const mockSession = { session_token: 'token123', username: 'user', role: 'admin' };
      AuthSession.create.mockResolvedValue(mockSession);

      const token = await createSession('user', 'admin');

      expect(AuthSession.create).toHaveBeenCalledWith({
        session_token: expect.any(String),
        username: 'user',
        role: 'admin',
        expires_at: expect.any(Date),
      });
      expect(token).toBeDefined();
    });

    it('should throw error on create failure', async () => {
      AuthSession.create.mockRejectedValue(new Error('DB error'));

      await expect(createSession('user', 'admin')).rejects.toThrow('DB error');
    });
  });

  describe('getSession', () => {
    it('should return session if valid', async () => {
      const mockSession = {
        username: 'user',
        role: 'admin',
        last_activity: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        created_at: new Date(),
      };
      AuthSession.findOne.mockResolvedValue(mockSession);
      AuthSession.update.mockResolvedValue();

      const session = await getSession('token123');

      expect(session).toEqual({ username: 'user', role: 'admin' });
      expect(AuthSession.update).toHaveBeenCalled();
    });

    it('should return null if session not found', async () => {
      AuthSession.findOne.mockResolvedValue(null);

      const session = await getSession('token123');

      expect(session).toBeNull();
    });

    it('should return null if session expired by inactivity', async () => {
      const mockSession = {
        username: 'user',
        role: 'admin',
        last_activity: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        created_at: new Date(),
      };
      AuthSession.findOne.mockResolvedValue(mockSession);
      AuthSession.destroy.mockResolvedValue();

      const session = await getSession('token123');

      expect(session).toBeNull();
      expect(AuthSession.destroy).toHaveBeenCalledWith({ where: { session_token: 'token123' } });
    });

    it('should return null if session expired by max usage', async () => {
      const mockSession = {
        username: 'user',
        role: 'admin',
        last_activity: new Date(),
        created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
      };
      AuthSession.findOne.mockResolvedValue(mockSession);
      AuthSession.destroy.mockResolvedValue();

      const session = await getSession('token123');

      expect(session).toBeNull();
      expect(AuthSession.destroy).toHaveBeenCalledWith({ where: { session_token: 'token123' } });
    });
  });

  describe('verifyUser', () => {
    it('should return user if credentials valid', async () => {
      const mockUser = { username: 'user', password: 'hashed', role: 'admin' };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const user = await verifyUser('user', 'pass');

      expect(user).toEqual({ username: 'user', role: 'admin' });
    });

    it('should return null if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      const user = await verifyUser('user', 'pass');

      expect(user).toBeNull();
    });

    it('should return null if password invalid', async () => {
      const mockUser = { username: 'user', password: 'hashed', role: 'admin' };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const user = await verifyUser('user', 'pass');

      expect(user).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const mockUser = { id: 1, username: 'user', role: 'admin' };
      User.create.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue('hashed');

      const user = await createUser('user', 'pass', 'admin');

      expect(bcrypt.hash).toHaveBeenCalledWith('pass', 10);
      expect(User.create).toHaveBeenCalledWith({ username: 'user', password: 'hashed', role: 'admin' });
      expect(user).toEqual({ id: 1, username: 'user', role: 'admin' });
    });
  });

  describe('listUsers', () => {
    it('should return list of users', async () => {
      const mockUsers = [{ id: 1, username: 'user1', role: 'admin' }];
      User.findAll.mockResolvedValue(mockUsers);

      const users = await listUsers();

      expect(users).toEqual(mockUsers);
    });
  });

  describe('updateUserPassword', () => {
    it('should update password', async () => {
      bcrypt.hash.mockResolvedValue('newhashed');
      User.update.mockResolvedValue();

      await updateUserPassword('user', 'newpass');

      expect(bcrypt.hash).toHaveBeenCalledWith('newpass', 10);
      expect(User.update).toHaveBeenCalledWith({ password: 'newhashed' }, { where: { username: 'user' } });
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      User.destroy.mockResolvedValue();

      await deleteUser('user');

      expect(User.destroy).toHaveBeenCalledWith({ where: { username: 'user' } });
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      AuthSession.destroy.mockResolvedValue(5);

      await cleanupExpiredSessions();

      expect(AuthSession.destroy).toHaveBeenCalled();
    });
  });
});