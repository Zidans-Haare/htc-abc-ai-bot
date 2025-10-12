const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const express = require("express");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const sharp = require('sharp');




// --- Initializations ---
dotenv.config();

const { sequelize } = require('./controllers/db.cjs');

// --- Controller Imports (after dotenv) ---
const { streamChat, getSuggestions, testApiKey } = require('./controllers/openaiController.cjs');
const feedbackController = require('./controllers/feedbackController.cjs');
const adminController = require('./controllers/adminController.cjs');
const auth = require('./controllers/authController.cjs');
const viewController = require('./controllers/viewController.cjs');
const dashboardController = require('./controllers/dashboardController.cjs');
const imageController = require('./controllers/imageController.cjs');
const app = express();
app.set('trust proxy', true);
const port = process.env.PORT || 3000;
const useHttps = process.argv.includes('-https');
const isTest = process.argv.includes('--test');
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

const dashboardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Higher limit for dashboard API calls
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
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(cookieParser());
app.use(express.json());


// Attach image controller routes
imageController(app);

// --- Static Files ---
// IMPORTANT: Serve static files before any protection middleware
app.use((req, res, next) => {
  if (req.url.startsWith('/admin') || (req.url.startsWith('/dash') && !req.url.startsWith('/dash/login'))) {
    return next();
  }
  express.static(path.join(__dirname, 'public'))(req, res, next);
});

// --- Protection Middleware ---
const requireAuth = (loginPath) => (req, res, next) => {
  const token = req.cookies.sessionToken;
  if (!token) {
    // Not logged in
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ error: 'Session expired. Please log in.' });
    }
    return res.redirect(loginPath);
  }
  auth.getSession(token).then(session => {
    if (session) {
      req.session = session;
      return next();
    } else {
      // Not logged in or expired
      if (req.url.startsWith('/api/')) {
        return res.status(401).json({ error: 'Session expired. Please log in.' });
      }
      return res.redirect(loginPath);
    }
  }).catch(err => {
    console.error('Auth error:', err);
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ error: 'Session error. Please log in.' });
    }
    return res.redirect(loginPath);
  });
};

const requireRole = (role, insufficientPath) => (req, res, next) => {
  const token = req.cookies.sessionToken;
  if (!token) {
    // Not logged in
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ error: 'Session expired. Please log in.' });
    }
    return res.redirect('/login');
  }
  auth.getSession(token).then(session => {
    if (session) {
      if (session.role === role) {
        req.session = session;
        return next();
      } else {
        // Insufficient permissions
        if (req.url.startsWith('/api/')) {
          return res.status(403).json({ error: 'Insufficient permissions. Please log in as a different user.' });
        }
        return res.redirect(insufficientPath);
      }
    } else {
      // Not logged in or expired
      if (req.url.startsWith('/api/')) {
        return res.status(401).json({ error: 'Session expired. Please log in.' });
      }
      return res.redirect('/login');
    }
  }).catch(err => {
    console.error('Auth error:', err);
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ error: 'Session error. Please log in.' });
    }
    return res.redirect('/login');
  });
};

const protect = (req, res, next) => {
  console.log(`Protect middleware: ${req.method} ${req.url}`);

  // Allow access to login pages and insufficient permissions page
  if (req.url.startsWith('/login') || req.url.startsWith('/dash/login') || req.url.startsWith('/insufficient-permissions')) {
    console.log('Allowing access to login page');
    return next();
  }

  // Dashboard routes require admin role
  if (req.url.startsWith('/dash') || req.url.startsWith('/api/dashboard')) {
    console.log('Checking admin role for dashboard');
    return requireRole('admin', '/insufficient-permissions')(req, res, next);
  }

  // Admin routes require authentication
  if (req.url.startsWith('/admin')) {
    console.log('Redirecting to login for admin');
    return res.redirect('/login');
  }

  console.log('Allowing access to public route');
  next();
};
app.use(protect);

// --- Static Files ---
app.use('/dash/login', express.static(path.join(__dirname, 'public', 'dash', 'login')));

// --- API Routes ---
app.use('/api/dashboard', dashboardLimiter); // Dashboard limiter FIRST
app.use('/api/login', loginLimiter);
app.use('/api', apiLimiter); // General limiter LAST

app.post('/api/chat', streamChat);
app.post('/api/test-api-key', testApiKey);
app.get('/api/suggestions', getSuggestions);
app.use('/api/feedback', feedbackController);
app.use('/api', auth.router);
app.use('/api', adminController(auth.getSession, logAction));
app.use('/api/dashboard', dashboardController);
app.get("/api/view/articles", viewController.getPublishedArticles);

// --- Dashboard Routes ---
app.get('/dash/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dash', 'login', 'login.html'));
});
app.use('/dash', express.static(path.join(__dirname, 'public', 'dash')));
app.get('/dash', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dash', 'index.html'));
});

// --- Admin Routes ---
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login', 'login.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// --- Insufficient Permissions Route ---
app.get('/insufficient-permissions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'insufficient-permissions.html'));
});

// --- Root Route ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Protected Static Files ---
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// --- Favicon & 404 ---
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// --- Server Start ---
const serverCallback = async () => {
  // Ensure auth sessions table exists
  try {
    const createAuthSessionsTable = require('./scripts/create_auth_sessions_table.js');
    await createAuthSessionsTable(false); // Don't close connection
    console.log('✓ Auth sessions table initialized');
  } catch (error) {
    console.error('Warning: Could not initialize auth sessions table:', error.message);
  }

  // Ensure dashboard tables exist
  try {
    const createDashboardTables = require('./scripts/create_dashboard_tables.js');
    await createDashboardTables(false); // Don't close connection
    console.log('✓ Dashboard tables initialized');
  } catch (error) {
    console.error('Warning: Could not initialize dashboard tables:', error.message);
  }

  // Authenticate database connection
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established');
  } catch (error) {
    console.error('Warning: Could not connect to database:', error.message);
  }

  // Sync all models to ensure tables exist
  try {
    await sequelize.sync();
    console.log('✓ All database tables synchronized');
  } catch (error) {
    console.error('Warning: Could not sync database:', error.message);
  }

  // Cleanup expired sessions on startup
  try {
    await auth.cleanupExpiredSessions();
    console.log('✓ Expired sessions cleaned up');
  } catch (error) {
    console.error('Warning: Could not cleanup sessions:', error.message);
  }

  // Periodic cleanup every hour
  setInterval(async () => {
    try {
      await auth.cleanupExpiredSessions();
    } catch (error) {
      console.error('Periodic session cleanup error:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  console.log(`Server is running with ${useHttps ? 'HTTPS' : 'HTTP'} on port ${port}`);
  fs.writeFile('server.pid', pid.toString(), err => {
    if (err) console.error('Error writing PID to server.pid:', err);
  });
};

if (!isTest) {
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
}
