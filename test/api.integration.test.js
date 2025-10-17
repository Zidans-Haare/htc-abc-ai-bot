const request = require('supertest');
const app = require('../server/server.cjs');
const auth = require('../server/controllers/authController.cjs');
const sinon = require('sinon');
const { User } = require('../server/controllers/db.cjs');

describe('API Endpoints', () => {
  let agent;
  let testUser;

  beforeAll(async () => {
    // Clean and create a test user
    await User.deleteMany({ where: { username: 'testadmin' } });
    testUser = await auth.createUser('testadmin', 'testpass', 'admin');
  });

  beforeEach(() => {
    agent = request.agent(app);
  });

  it('POST /api/login succeeds for valid', async () => {
    const res = await agent.post('/api/login').send({ username: 'testadmin', password: 'testpass' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /api/login fails for invalid creds', async () => {
    const res = await agent.post('/api/login').send({ username: 'fake', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('GET /api/validate without token', async () => {
    const res = await agent.get('/api/validate');
    expect(res.status).toBe(401);
  });

  it('POST /api/logout', async () => {
    const res = await agent.post('/api/logout');
    expect(res.status).toBe(200);
  });

  // Security: Rate limit on login
  it('Rate limit on login', async () => {
    for (let i = 0; i < 10; i++) {
      await agent.post('/api/login').send({ username: 'flood', password: 'pass' });
    }
    const res = await agent.post('/api/login').send({ username: 'flood', password: 'pass' });
    expect(res.status).toBe(429);
  });

  // XSS: Test if input is sanitized, but since login, perhaps in other endpoints.
  // For chat or feedback.

  it('GET /api/health', async () => {
    const res = await agent.get('/api/health');
    expect(res.status).toBe(200);
  });
});