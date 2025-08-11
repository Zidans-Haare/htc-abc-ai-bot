const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const express = require("express");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// --- Controller Imports ---
const { generateResponse, getSuggestions } = require('./controllers/geminiController.cjs');
const feedbackController = require('./controllers/feedbackController.cjs');
const adminController = require('./controllers/adminController.cjs');
const auth = require('./controllers/authController.cjs');
const viewController = require('./controllers/viewController.cjs');
const dashboardController = require('./controllers/dashboardController.cjs');

// --- Initializations ---
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const useHttps = process.argv.includes('-https');
const useAdmin = process.argv.includes('-admin');
const pid = process.pid;

// --- Logging ---
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

// --- Security & Rate Limiting ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

const dashboardApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Much higher limit for internal dashboard
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: "Too many login attempts from this IP, please try again after an hour",
    standardHeaders: true,
    legacyHeaders: false,
});

// --- Middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(cookieParser());
app.use(express.json());

// --- Protection Middleware ---
const protect = async (req, res, next) => {
  if (useAdmin && (req.url.startsWith('/admin/') || req.url.startsWith('/dashboard'))) {
    console.log('ADMIN mode: Bypassing login and creating session for debug_admin');
    const token = await auth.createSession('debug_admin', 'admin');
    res.cookie('sessionToken', token, { httpOnly: true, secure: useHttps, maxAge: 1000 * 60 * 60, sameSite: 'strict' });
    req.session = await auth.getSession(token);
    return next();
  }

  if (req.url.startsWith('/login/')) {
    return next();
  }

  if (req.url.startsWith('/admin/') || req.url.startsWith('/dashboard')) {
    const token = req.cookies.sessionToken;
    const session = token && await auth.getSession(token);
    if (session) {
      req.session = session;
      return next();
    }
    return res.status(401).sendFile(path.join(__dirname, 'public', 'login', 'login.html'));
  }
  next();
};
app.use(protect);

// --- Static Files ---
app.use(express.static('public'));
app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dashboard')));

// --- API Routes ---
app.use('/api', apiLimiter);
app.use('/api/login', loginLimiter);

app.post('/api/chat', generateResponse);
app.get('/api/suggestions', getSuggestions);
app.use('/api/feedback', feedbackController);
app.use('/api', auth.router);
app.use('/api', adminController(auth.getSession, logAction));
app.use('/api/dashboard', dashboardApiLimiter, dashboardController);
app.get("/api/view/articles", viewController.getPublishedArticles);

// --- Favicon & 404 ---
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// --- Server Start ---
const serverCallback = () => {
  console.log(`Server is running with ${useHttps ? 'HTTPS' : 'HTTP'} on port ${port}`);
  fs.writeFile('server.pid', pid.toString(), err => {
    if (err) console.error('Error writing PID to server.pid:', err);
  });
};

if (useHttps) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(path.join(os.homedir(), '.ssh', 'key.pem')),
      cert: fs.readFileSync(path.join(os.homedir(), '.ssh', 'cert.pem'))
    };
    https.createServer(httpsOptions, app).listen(port, serverCallback);
  } catch (e) {
    console.error("Could not start HTTPS server. Do you have key.pem and cert.pem in your .ssh directory?", e);
    process.exit(1);
  } 
} else {
  app.listen(port, serverCallback);
}
