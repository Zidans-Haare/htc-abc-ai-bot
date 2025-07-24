const fs = require('fs');
const https = require('https');
const os = require('os');
const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { generateResponse } = require("./controllers/geminiController.cjs");
const feedbackController = require("./controllers/feedbackController.cjs");
const adminController = require("./controllers/adminController.cjs");
const auth = require('./controllers/authController.cjs');
const path = require('path');
const { sequelize, Feedback } = require('./controllers/db.cjs');

const pid = process.pid;

dotenv.config();


const app = express();

// Ensure log directory exists
const logDir = path.resolve(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const auditLog = path.resolve(__dirname, 'logs/audit.log');
function logAction(user, action) {
  const line = `[${new Date().toISOString()}] ${user} ${action}\n`;
  fs.appendFile(auditLog, line, (err) => {
    if (err) console.error('Audit log error:', err);
  });
}

const useAdmin = process.argv.includes('-admin');

if (useAdmin) {
  console.log('ADMIN mode: Bypassing login and creating session for debug_admin');
}

// Middleware für geschützte Admin-Ressourcen
const protectAdmin = (req, res, next) => {
  // Erlaube /login/* ohne Sitzungsprüfung
  if (req.url.startsWith('/login/')) {
    return next();
  }
  // Prüfe Sitzung für /admin/*
  if (req.url.startsWith('/admin/')) {
    if (useAdmin) {
      const token = auth.createSession('debug_admin', 'admin');
      res.cookie('sessionToken', token, {
        httpOnly: true,
        secure: useHttps,
        maxAge: 1000 * 60 * 60,
        sameSite: 'strict'
      });
      req.session = auth.getSession(token);
      return next();
    }
    const token = req.cookies.sessionToken;
    const session = token && auth.getSession(token);
    if (session) {
      req.session = session;
      return next();
    }
    return res.status(401).sendFile(path.join(__dirname, 'public', 'login', 'login.html'));
  }
  next();
};

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 requests per windowMs
    message: "Too many login attempts from this IP, please try again after an hour",
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com" // Add for jsPDF
      ],
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
        "https://cdnjs.cloudflare.com"
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

// Middleware für geschützte Dashboard-Ressourcen
const protectDashboard = (req, res, next) => {
  // Prüfe Sitzung für /dashboard/*
  if (req.url.startsWith('/dashboard')) {
    if (useAdmin) {
      const token = auth.createSession('debug_admin', 'admin');
      res.cookie('sessionToken', token, {
        httpOnly: true,
        secure: useHttps,
        maxAge: 1000 * 60 * 60,
        sameSite: 'strict'
      });
      req.session = auth.getSession(token);
      return next();
    }
    const token = req.cookies.sessionToken;
    const session = token && auth.getSession(token);
    if (session) {
      req.session = session;
      return next();
    }
    return res.status(401).sendFile(path.join(__dirname, 'public', 'login', 'login.html'));
  }
  next();
};
app.use(protectDashboard);
app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dashboard')));

app.use(express.static(path.join(__dirname, 'public')));

// Apply the rate limiting middleware to API calls
app.use('/api', apiLimiter);
app.use('/api/login', loginLimiter);

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api', auth.router);
app.post("/api/chat", generateResponse);

app.use('/api/feedback', feedbackController);

// Mount admin routes
app.use('/api', adminController(auth.getSession, logAction));

// Handle favicon.ico
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Catch-all for 404
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// Start server
const PORT = process.env.PORT || 3002;
const useHttps = process.argv.includes('-https');

if (useHttps) {
  const homeDir = os.homedir();
  const httpsOptions = {
    key: fs.readFileSync(path.join(homeDir, '.ssh', 'key.pem')),
    cert: fs.readFileSync(path.join(homeDir, '.ssh', 'cert.pem'))
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Server is running with HTTPS on port ${PORT}`);
    fs.writeFile('server.pid', pid.toString(), err => {
      if (err) console.error('Error writing PID to server.pid:', err);
    });
  });
} else {
  app.listen(PORT, () => {
    console.log(`Server is running with HTTP on port ${PORT}`);
    fs.writeFile('server.pid', pid.toString(), err => {
      if (err) console.error('Error writing PID to server.pid:', err);
    });
  });
}
