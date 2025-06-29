const fs = require('fs');
const crypto = require('crypto');
const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const { generateResponse } = require("./controllers/geminiController.cjs");
const adminController = require("./controllers/adminController.cjs");
const auth = require('./controllers/authController.cjs');
const path = require('path');

const pid = process.pid;

dotenv.config();

const app = express();
const SESSION_TTL = 1000 * 60 * 60; // 1 hour
const sessions = {};
function createSession(username, role) {
  const token = crypto.randomBytes(16).toString('hex');
  sessions[token] = { username, role, created: Date.now(), expires: Date.now() + SESSION_TTL };
  return token;
}
function destroySession(token) { delete sessions[token]; }
function getSession(token) {
  const s = sessions[token];
  if (!s) return null;
  if (Date.now() > s.expires) { delete sessions[token]; return null; }
  return s;
}
const auditLog = path.resolve(__dirname, 'logs/audit.log');
function logAction(user, action) {
  const line = `[${new Date().toISOString()}] ${user} ${action}\n`;
  fs.appendFile(auditLog, line, () => {});
}

auth.init();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Headers:", req.headers);
  console.log("Base URL:", req.baseUrl, "Path:", req.path);
  next();
});

// Routes
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  try {
    const user = await auth.verifyUser(username, password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = createSession(user.username, user.role);
    res.json({ token, role: user.role });
  } catch (err) {
    console.error('Login failed', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['x-session-token'];
  if (token) destroySession(token);
  res.json({ success: true });
});

app.post("/api/chat", generateResponse);

// Mount admin routes with getSession and logAction
app.use('/api', adminController(getSession, logAction));

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Handle favicon.ico to suppress 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Catch-all for debugging
app.use((req, res) => {
  console.log("Unhandled request:", req.method, req.url);
  res.status(404).send(`Cannot ${req.method} ${req.url}`);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Save PID to file
  fs.writeFile('server.pid', pid.toString(), err => {
    if (err) console.error('Error writing PID to server.pid:', err);
  });
});