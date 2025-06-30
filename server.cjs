const fs = require('fs');
const crypto = require('crypto');
const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
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
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { username, role, created: Date.now(), expires: Date.now() + SESSION_TTL };
  console.log('Created session:', { token, username, role, expires: new Date(sessions[token].expires).toISOString() });
  return token;
}

function destroySession(token) {
  console.log('Destroying session:', token);
  delete sessions[token];
}

function getSession(token) {
  const s = sessions[token];
  if (!s) {
    console.log('Session not found for token:', token);
    return null;
  }
  if (Date.now() > s.expires) {
    console.log('Session expired for token:', token);
    delete sessions[token];
    return null;
  }
  console.log('Session retrieved:', { token, username: s.username, role: s.role });
  return s;
}

const auditLog = path.resolve(__dirname, 'logs/audit.log');
function logAction(user, action) {
  const line = `[${new Date().toISOString()}] ${user} ${action}\n`;
  fs.appendFile(auditLog, line, (err) => {
    if (err) console.error('Audit log error:', err);
  });
}

// Rate-Limiting für Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 10, // Max 10 Anfragen pro IP
  message: { error: 'Zu viele Login-Versuche, bitte in 15 Minuten erneut versuchen' }
});

// Middleware für geschützte Admin-Ressourcen
const protectAdmin = (req, res, next) => {
  // Erlaube /login/* ohne Sitzungsprüfung
  if (req.url.startsWith('/login/')) {
    console.log('Allowing /login/* request:', req.url);
    return next();
  }
  // Prüfe Sitzung für /admin/*
  if (req.url.startsWith('/admin/')) {
    const token = req.cookies.sessionToken;
    console.log('Checking session for /admin/* request:', { url: req.url, token });
    const session = token && getSession(token);
    if (session) {
      req.session = session;
      console.log('Session valid for /admin/*:', { username: session.username, role: session.role });
      return next();
    }
    console.log('No valid session, redirecting to login.html');
    return res.status(401).sendFile(path.join(__dirname, 'public', 'login', 'login.html'));
  }
  next();
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com" // Add Font Awesome font domain
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

app.use(cookieParser());
app.use(bodyParser.json());
app.use(protectAdmin);
app.use(express.static(path.join(__dirname, 'public')));

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Headers:", req.headers);
  console.log("Cookies:", req.cookies);
  next();
});

// Routes
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    logAction('anonymous', 'Failed login: Missing credentials');
    return res.status(400).json({ error: 'Missing credentials' });
  }
  try {
    const user = await auth.verifyUser(username, password);
    if (!user) {
      logAction(username, 'Failed login: Invalid credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = createSession(user.username, user.role);
    logAction(username, 'Successful login');
    res.cookie('sessionToken', token, { httpOnly: true, secure: true, maxAge: SESSION_TTL }); // Entferne secure für Tests
    res.json({ role: user.role });
  } catch (err) {
    console.error('Login failed:', err);
    logAction(username, 'Login error');
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/validate', (req, res) => {
  const token = req.cookies.sessionToken;
  console.log('Validating session:', { token });
  const session = token && getSession(token);
  if (session) {
    res.json({ valid: true, username: session.username, role: session.role });
  } else {
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies.sessionToken;
  console.log('Logging out:', { token });
  if (token) {
    const session = getSession(token);
    if (session) logAction(session.username, 'Logout');
    destroySession(token);
  }
  res.clearCookie('sessionToken');
  res.json({ success: true });
});

app.post("/api/chat", generateResponse);

// Mount admin routes
app.use('/api', adminController(getSession, logAction));

// Handle favicon.ico
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Catch-all for 404
app.use((req, res) => {
  console.log("Unhandled request:", req.method, req.url);
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  fs.writeFile('server.pid', pid.toString(), err => {
    if (err) console.error('Error writing PID to server.pid:', err);
  });
});