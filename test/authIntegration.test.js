const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
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

const { router } = require('../server/controllers/authController.cjs');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', router);

describe('Auth Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should login successfully and set cookie', async () => {
      const mockUser = { id: 'userId', username: 'user', password: 'hashed', role: 'admin' };
      User.findFirst.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      AuthSession.create.mockResolvedValue({ id: 'sessionId', token: 'token123' });

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'user', password: 'pass' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ role: 'admin' });
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Missing credentials' });
    });

    it('should return 401 for invalid credentials', async () => {
      User.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'user', password: 'pass' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid credentials' });
    });
  });

  describe('GET /auth/validate', () => {
    it('should validate session successfully', async () => {
      const mockSession = {
        updated_at: new Date(),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 1000000),
        user: { username: 'user', role: 'admin' }
      };
      AuthSession.findFirst.mockResolvedValue(mockSession);
      AuthSession.updateMany.mockResolvedValue();

      const response = await request(app)
        .get('/auth/validate')
        .set('Cookie', ['session_token=token123']);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ valid: true, username: 'user', role: 'admin' });
    });

    it('should return 401 for invalid session', async () => {
      AuthSession.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/auth/validate')
        .set('Cookie', ['sessionToken=invalid']);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ valid: false, error: 'Invalid or expired token' });
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout and clear cookie', async () => {
      AuthSession.deleteMany.mockResolvedValue();

      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', ['session_token=token123']);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(AuthSession.deleteMany).toHaveBeenCalledWith({ where: { token: 'token123' } });
    });
  });

  describe('Role-based login and validation', () => {
    it('should login admin user successfully', async () => {
      const mockUser = { id: 'userId', username: 'admin', password: 'hashed', role: 'admin' };
      User.findFirst.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      AuthSession.create.mockResolvedValue({ id: 'sessionId', token: 'token123' });

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'pass' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ role: 'admin' });
    });

    it('should login editor user successfully', async () => {
      const mockUser = { id: 'userId', username: 'editor', password: 'hashed', role: 'editor' };
      User.findFirst.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      AuthSession.create.mockResolvedValue({ id: 'sessionId', token: 'token123' });

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'editor', password: 'pass' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ role: 'editor' });
    });

    it('should login entwickler user successfully', async () => {
      const mockUser = { id: 'userId', username: 'entwickler', password: 'hashed', role: 'entwickler' };
      User.findFirst.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      AuthSession.create.mockResolvedValue({ id: 'sessionId', token: 'token123' });

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'entwickler', password: 'pass' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ role: 'entwickler' });
    });
  });

  describe('Invalid credentials and tokens', () => {
    it('should return 401 for wrong password', async () => {
      const mockUser = { id: 'userId', username: 'user', password: 'hashed', role: 'admin' };
      User.findFirst.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'user', password: 'wrongpass' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid credentials' });
    });

    it('should return 401 for non-existent user', async () => {
      User.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'nonexistent', password: 'pass' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid credentials' });
    });

    it('should return 401 for validate with invalid token', async () => {
      AuthSession.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/auth/validate')
        .set('Cookie', ['session_token=invalidtoken']);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ valid: false, error: 'Invalid or expired token' });
    });

    it('should return 401 for validate with expired session', async () => {
      const mockSession = {
        updated_at: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        created_at: new Date(),
        expires_at: new Date(Date.now() + 1000000),
        user: { username: 'user', role: 'admin' }
      };
      AuthSession.findFirst.mockResolvedValue(mockSession);
      AuthSession.deleteMany.mockResolvedValue();

      const response = await request(app)
        .get('/auth/validate')
        .set('Cookie', ['session_token=expiredtoken']);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ valid: false, error: 'Invalid or expired token' });
      expect(AuthSession.deleteMany).toHaveBeenCalledWith({ where: { token: 'expiredtoken' } });
    });
  });
});