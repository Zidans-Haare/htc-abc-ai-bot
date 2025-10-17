const { getSession, createSession, verifyUser, createUser, listUsers, updateUserPassword, deleteUser, cleanupExpiredSessions } = require('../server/controllers/authController.cjs');
const { User, AuthSession } = require('../server/controllers/db.cjs');
const bcrypt = require('bcryptjs');

// Mock the db module
jest.mock('../server/controllers/db.cjs', () => ({
  User: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  AuthSession: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
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
      const mockSession = { id: 'sessionId', user_id: 'userId', token: 'token123', expires_at: new Date() };
      AuthSession.create.mockResolvedValue(mockSession);

      const token = await createSession('userId');

      expect(AuthSession.create).toHaveBeenCalledWith({
        data: {
          user_id: 'userId',
          token: expect.any(String),
          expires_at: expect.any(Date),
        }
      });
      expect(token).toBeDefined();
    });

    it('should throw error on create failure', async () => {
      AuthSession.create.mockRejectedValue(new Error('DB error'));

      await expect(createSession('userId')).rejects.toThrow('DB error');
    });
  });

  describe('getSession', () => {
    it('should return session if valid', async () => {
      const mockSession = {
        updated_at: new Date(),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 1000000),
        user: { username: 'user', role: 'admin' }
      };
      AuthSession.findFirst.mockResolvedValue(mockSession);
      AuthSession.updateMany.mockResolvedValue();

      const session = await getSession('token123');

      expect(session).toEqual({ username: 'user', role: 'admin' });
      expect(AuthSession.updateMany).toHaveBeenCalled();
    });

    it('should return null if session not found', async () => {
      AuthSession.findFirst.mockResolvedValue(null);

      const session = await getSession('token123');

      expect(session).toBeNull();
    });

    it('should return null if session expired by inactivity', async () => {
      const mockSession = {
        updated_at: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        created_at: new Date(),
        expires_at: new Date(Date.now() + 1000000),
        user: { username: 'user', role: 'admin' }
      };
      AuthSession.findFirst.mockResolvedValue(mockSession);
      AuthSession.deleteMany.mockResolvedValue();

      const session = await getSession('token123');

      expect(session).toBeNull();
      expect(AuthSession.deleteMany).toHaveBeenCalledWith({ where: { token: 'token123' } });
    });

    it('should return null if session expired by max usage', async () => {
      const mockSession = {
        updated_at: new Date(),
        created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
        expires_at: new Date(Date.now() + 1000000),
        user: { username: 'user', role: 'admin' }
      };
      AuthSession.findFirst.mockResolvedValue(mockSession);
      AuthSession.deleteMany.mockResolvedValue();

      const session = await getSession('token123');

      expect(session).toBeNull();
      expect(AuthSession.deleteMany).toHaveBeenCalledWith({ where: { token: 'token123' } });
    });
  });

  describe('verifyUser', () => {
    it('should return user if credentials valid', async () => {
      const mockUser = { id: 'userId', username: 'user', password: 'hashed', role: 'admin' };
      User.findFirst.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const user = await verifyUser('user', 'pass');

      expect(user).toEqual({ id: 'userId', username: 'user', role: 'admin' });
    });

    it('should return null if user not found', async () => {
      User.findFirst.mockResolvedValue(null);

      const user = await verifyUser('user', 'pass');

      expect(user).toBeNull();
    });

    it('should return null if password invalid', async () => {
      const mockUser = { username: 'user', password: 'hashed', role: 'admin' };
      User.findFirst.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const user = await verifyUser('user', 'pass');

      expect(user).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const mockUser = { id: 'userId', username: 'user', role: 'admin' };
      User.create.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue('hashed');

      const user = await createUser('user', 'pass', 'admin');

      expect(bcrypt.hash).toHaveBeenCalledWith('pass', 10);
      expect(User.create).toHaveBeenCalledWith({ data: { username: 'user', password: 'hashed', role: 'admin' } });
      expect(user).toEqual({ id: 'userId', username: 'user', role: 'admin' });
    });
  });

  describe('listUsers', () => {
    it('should return list of users', async () => {
      const mockUsers = [{ id: 'userId', username: 'user1', role: 'admin' }];
      User.findMany.mockResolvedValue(mockUsers);

      const users = await listUsers();

      expect(users).toEqual(mockUsers);
    });
  });

  describe('updateUserPassword', () => {
    it('should update password', async () => {
      bcrypt.hash.mockResolvedValue('newhashed');
      User.updateMany.mockResolvedValue();

      await updateUserPassword('user', 'newpass');

      expect(bcrypt.hash).toHaveBeenCalledWith('newpass', 10);
      expect(User.updateMany).toHaveBeenCalledWith({ where: { username: 'user' }, data: { password: 'newhashed' } });
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      User.deleteMany.mockResolvedValue();

      await deleteUser('user');

      expect(User.deleteMany).toHaveBeenCalledWith({ where: { username: 'user' } });
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      AuthSession.deleteMany.mockResolvedValue(5);

      await cleanupExpiredSessions();

      expect(AuthSession.deleteMany).toHaveBeenCalled();
    });
  });
});