const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
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

const { router } = require('../controllers/authController.cjs');

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
      const mockUser = { username: 'user', password: 'hashed', role: 'admin' };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      AuthSession.create.mockResolvedValue({ session_token: 'token123' });

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
      User.findOne.mockResolvedValue(null);

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
        username: 'user',
        role: 'admin',
        last_activity: new Date(),
        created_at: new Date(),
      };
      AuthSession.findOne.mockResolvedValue(mockSession);
      AuthSession.update.mockResolvedValue();

      const response = await request(app)
        .get('/auth/validate')
        .set('Cookie', ['sessionToken=token123']);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ valid: true, username: 'user', role: 'admin' });
    });

    it('should return 401 for invalid session', async () => {
      AuthSession.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/auth/validate')
        .set('Cookie', ['sessionToken=invalid']);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ valid: false, error: 'Invalid or expired token' });
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout and clear cookie', async () => {
      AuthSession.destroy.mockResolvedValue();

      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', ['sessionToken=token123']);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(AuthSession.destroy).toHaveBeenCalledWith({ where: { session_token: 'token123' } });
    });
  });
});