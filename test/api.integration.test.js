const request = require('supertest');
const app = require('../server/server.cjs');
const auth = require('../server/controllers/authController.cjs');
const { User } = require('../server/controllers/db.cjs');

// Suppress AI key warning
jest.spyOn(console, 'error').mockImplementation((msg) => {
  if (msg.includes('CHAT_AI_TOKEN/OPENAI_API_KEY/KISSKI_API_KEY is not set')) {
    return;
  }
  console.error(msg);
});

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
  it.skip('Rate limit on login', async () => {
    for (let i = 0; i < 10; i++) {
      await agent.post('/api/login').send({ username: 'flood', password: 'pass' });
    }
    const res = await agent.post('/api/login').send({ username: 'flood', password: 'pass' });
    expect(res.status).toBe(429);
  });

  // Security: Test input sanitization (XSS prevention)
  it('POST /api/chat sanitizes input', async () => {
    const maliciousInput = '<script>alert("xss")</script> Hello';
    const res = await agent.post('/api/chat').send({ message: maliciousInput });

    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      // Check that script tags are removed or escaped
      expect(res.body.response).not.toContain('<script>');
      expect(res.body.response).toContain('Hello'); // But sanitized
    }
  });

  // Security: Test SQL injection prevention
  it('POST /api/login prevents SQL injection', async () => {
    const sqlInjectionUsername = "admin' --";
    const res = await agent.post('/api/login').send({ username: sqlInjectionUsername, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  // Security: Test XSS in head/body injection
  it('POST /api/chat prevents JS injection in head', async () => {
    const headInjection = '<head><script>alert("xss")</script></head> Hello';
    const res = await agent.post('/api/chat').send({ message: headInjection });

    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.response).not.toContain('<script>');
      expect(res.body.response).not.toContain('<head>');
    }
  });

  it('POST /api/chat prevents JS injection in body', async () => {
    const bodyInjection = '<body onload="alert(\'xss\')"> Hello';
    const res = await agent.post('/api/chat').send({ message: bodyInjection });

    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.response).not.toContain('<body');
      expect(res.body.response).not.toContain('onload');
    }
  });

  // Test auth middleware for protected routes
  it('GET /admin/ requires auth', async () => {
    const res = await agent.get('/admin/');
    expect([302, 401]).toContain(res.status); // Redirect or unauthorized
  });

  it('GET /admin/ succeeds with auth', async () => {
    // Wait a bit to avoid rate limit
    await new Promise(resolve => setTimeout(resolve, 1000));
    const loginRes = await agent.post('/api/login').send({ username: 'testadmin', password: 'testpass' });
    expect(loginRes.status).toBe(200);
    const res = await agent.get('/admin/');
    expect([200, 302]).toContain(res.status);
  });

  // Test helmet headers
  it('should set security headers', async () => {
    const res = await agent.get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN'); // Default helmet setting
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("'self'"); // Only same domain
  });

  it('GET /api/health', async () => {
    const res = await agent.get('/api/health');
    expect(res.status).toBe(200);
  });
});