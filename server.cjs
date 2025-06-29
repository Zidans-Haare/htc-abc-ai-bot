// run on all-inkl.com:
//
// old way:
// 	$ nohup node server.cjs &
// kill 
//	$ kill -9 $(cat server.pid) 
// restart
//	$ kill -9 $(cat server.pid) ; sleep 1 ; nohup node server.cjs &
//
// new way: pm2 to start the server
// 		$ cd dev.olomek.com ; pm2 kill ; nohup pm2 start server_pm2_watch.ecosystem.config.js ; pm2 list
// end pm2
//		$ pm2 kill
// log
//		$ pm2 log server

const fs = require('fs');
const crypto = require('crypto');
const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const { generateResponse } = require("./controllers/geminiController.cjs");

const { getHeadlines, getEntry, createEntry, updateEntry, deleteEntry, getArchive, restoreEntry, HochschuhlABC } = require("./controllers/adminController.cjs");
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

function adminAuth(req, res, next) {
  const token = req.headers['x-session-token'];
  const session = token && getSession(token);
  if (session) {
    req.user = session.username;
    req.role = session.role;
    logAction(session.username, `${req.method} ${req.originalUrl}`);
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}



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



// Admin routes Grok/thomas
app.use('/api/admin', adminAuth);
app.get("/api/admin/headlines", getHeadlines);
app.get("/api/admin/archive", getArchive);

app.post("/api/admin/restore/:id", restoreEntry);


app.get("/api/admin/entries/:id", getEntry);
app.post("/api/admin/entries", createEntry);
app.put("/api/admin/entries/:id", updateEntry);
app.delete("/api/admin/entries/:id", deleteEntry);

app.get('/api/admin/users', async (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const users = await auth.listUsers();
  res.json(users);
});

app.post('/api/admin/users', async (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing' });
  try {
    const user = await auth.createUser(username, password, role || 'editor');
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  } catch (err) {
    console.error('Failed to create user', err);
    res.status(500).json({ error: 'failed' });
  }
});

app.get('/api/admin/export', async (req, res) => {
  try {
    const entries = await HochschuhlABC.findAll();
    const unansweredFile = path.resolve(__dirname, 'ai_fragen/offene_fragen.txt');
    const unanswered = (await fs.promises.readFile(unansweredFile, 'utf8')).split(/\n+/).filter(Boolean);
    const faqFile = path.resolve(__dirname, 'ai_input/faq.txt');
    const data = await fs.promises.readFile(faqFile, 'utf8');
    const lines = data.split(/\n+/).filter(Boolean);
    const answered = [];
    for (let i=0;i<lines.length;i++) {
      const q = lines[i].match(/^F:(.*)/);
      const a = lines[i+1] && lines[i+1].match(/^A:(.*)/);
      if (q && a) {
        answered.push({ question: q[1].trim(), answer: a[1].trim() });
        i++;
      }
    }
    res.json({ entries, unanswered, answered });
  } catch (err) {
    console.error('Export failed', err);
    res.status(500).json({ error: 'export failed' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const entries = await HochschuhlABC.findAll();
    const perEditor = {};
    entries.forEach(e => {
      const name = e.editor || 'unknown';
      perEditor[name] = (perEditor[name] || 0) + 1;
    });
    res.json({ total: entries.length, perEditor });
  } catch (err) {
    console.error('Stats failed', err);
    res.status(500).json({ error: 'stats failed' });
  }
});


// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

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
