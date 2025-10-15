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
const Joi = require('joi');
const { program } = require('commander');
const winston = require('winston');
const promClient = require('prom-client');
const bcrypt = require('bcryptjs');
const { execSync } = require('child_process');



// --- Initializations ---
dotenv.config();

// Env validation
const envSchema = Joi.object({
  VECTOR_DB_TYPE: Joi.string().valid('none', 'chroma', 'weaviate').default('none'),
  CHUNK_SIZE: Joi.number().integer().min(200).max(1000).default(500),
  CHUNK_OVERLAP: Joi.number().integer().min(0).max(200).default(50),
  RETRIEVE_K: Joi.number().integer().min(1).max(10).default(3),
  MIN_SIMILARITY: Joi.number().min(0).max(1).default(0.7),
  SYNC_ON_START: Joi.string().valid('true', 'false').default('false'),
  ENABLE_GRAPHRAG: Joi.string().valid('true', 'false').default('false'),
  CHROMA_URL: Joi.string().when('VECTOR_DB_TYPE', { is: 'chroma', then: Joi.required() }),
  CHROMA_COLLECTION: Joi.string().when('VECTOR_DB_TYPE', { is: 'chroma', then: Joi.required() }),
    WEAVIATE_URL: Joi.string().when('VECTOR_DB_TYPE', { is: 'weaviate', then: Joi.required() }),
    WEAVIATE_COLLECTION: Joi.string().when('VECTOR_DB_TYPE', { is: 'weaviate', then: Joi.required() }),
    PDF_CHUNK_SIZE: Joi.number().integer().min(100).max(1000).default(300),
    PDF_EXTRACT_TEXT_ONLY: Joi.string().valid('true', 'false').default('false'),
    SYNC_BATCH: Joi.number().integer().min(10).max(500).default(100),
    DISPLAY_TOKEN_USED_FOR_QUERY: Joi.string().valid('true', 'false').default('false'),
    EMBEDDING_LIBRARY: Joi.string().valid('xenova', 'huggingface').default('xenova'),
    SESSION_INACTIVITY_TIMEOUT_MINUTES: Joi.number().integer().min(1).max(10080).default(1440),  // 1 min to 1 week
    SESSION_MAX_DURATION_MINUTES: Joi.number().integer().min(1).max(525600).default(43200),  // 1 min to 1 year
    MAIN_DB_TYPE: Joi.string().valid('sqlite', 'postgresql', 'mysql').default('sqlite'),
    MAIN_DB_PATH: Joi.string().default('hochschuhl-abc.db'),
    MAIN_DB_HOST: Joi.string().when('MAIN_DB_TYPE', { not: 'sqlite', then: Joi.required() }),
    MAIN_DB_PORT: Joi.number().integer().min(1).max(65535).default(3306),
    MAIN_DB_USER: Joi.string().when('MAIN_DB_TYPE', { not: 'sqlite', then: Joi.required() }),
    MAIN_DB_PASSWORD: Joi.string().when('MAIN_DB_TYPE', { not: 'sqlite', then: Joi.required() }),
    MAIN_DB_NAME: Joi.string().when('MAIN_DB_TYPE', { not: 'sqlite', then: Joi.required() }),
    MAIN_DB_SSL: Joi.string().valid('true', 'false').default('false')
}).unknown(true);

const { error } = envSchema.validate(process.env);
if (error) {
  console.error('Env validation failed:', error.details[0].message);
  process.exit(1);
}

const { prisma } = require('./controllers/db.cjs');

// --- Graceful Shutdown ---
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();  // Closes pool connections
  process.exit(0);
});

process.on('SIGINT', async () => {  // Ctrl+C
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Also handle uncaught errors
process.on('uncaughtException', async (err) => {
  console.error('Uncaught Exception:', err);
  await prisma.$disconnect();
  process.exit(1);
});

// --- Controller Imports (after dotenv) ---
const { streamChat, getSuggestions, testApiKey } = require('./controllers/openaiController.cjs');
const feedbackController = require('./controllers/feedbackController.cjs');
const adminController = require('./controllers/adminController.cjs');
const auth = require('./controllers/authController.cjs');
const viewController = require('./controllers/viewController.cjs');
const dashboardController = require('./controllers/dashboardController.cjs');
const imageController = require('./controllers/imageController.cjs');
const app = express();
// Trust proxy layers for correct client IP detection (default 2: Cloudflare -> Nginx -> Node.js)
app.set('trust proxy', process.env.TRUST_PROXY_COUNT || 2);
const port = process.env.PORT || 3000;
const useHttps = process.argv.includes('-https');
const isTest = process.argv.includes('--test');
const isDev = process.argv.includes('-dev');
const pid = process.pid;

// CLI options
program
  .option('--init-vectordb', 'Initialize/populate vector DB from current articles')
  .option('--drop-vectordb', 'Drop/clear vector DB collections')
  .parse();

const options = program.opts();

// Handle CLI options
let cliMode = options.initVectordb || options.dropVectordb;
if (options.initVectordb) {
  (async () => {
    try {
      // Ensure DB connection
      await prisma.$connect();
      console.log('DB connected for CLI');
      console.log('Initializing vector DB...');
      const vectorStore = require('./lib/vectorStore');
      const stats = await vectorStore.initVectorDB();
      console.log(`Vector DB initialized successfully: ${stats.chunks} chunks from ${stats.articles} articles and ${stats.pdfs} PDFs synced`);
      process.exit(0);
    } catch (err) {
      console.error('Vector DB initialization failed:', err);
      process.exit(1);
    }
  })();
}
if (options.dropVectordb) {
  (async () => {
    try {
      console.log('Dropping vector DB...');
      const vectorStore = require('./lib/vectorStore');
      await vectorStore.dropVectorDB();
      console.log('Vector DB dropped successfully');
      process.exit(0);
    } catch (err) {
      console.error('Vector DB drop failed:', err);
      process.exit(1);
    }
  })();
}

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
    trustProxy: parseInt(process.env.TRUST_PROXY_COUNT) || 2,
});

const dashboardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Higher limit for dashboard API calls
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: parseInt(process.env.TRUST_PROXY_COUNT) || 2,
});

const loginLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 6,
    message: "Too many login attempts from this IP, please try again after an hour",
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: parseInt(process.env.TRUST_PROXY_COUNT) || 2,
    skipSuccessfulRequests: true, // Only count failed login attempts
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
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

// --- Middleware ---
if (isDev) {
  app.use((req, res, next) => {
    if (req.path.match(/\.(js|css|html)$/)) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
    next();
  });
}

// --- Static Files ---
// IMPORTANT: Serve static files before any protection middleware
app.use((req, res, next) => {
  if (req.url.startsWith('/admin') || (req.url.startsWith('/dash') && !req.url.startsWith('/dash/login'))) {
    return next();
  }
  express.static(path.join(__dirname, 'public'))(req, res, next);
});

// --- Protection Middleware ---
const requireAuth = (loginPath) => async (req, res, next) => {
  try {
    const token = req.cookies.session_token;
    if (!token) {
      // Not logged in
      if (req.url.startsWith('/api/')) {
        return res.status(401).json({ error: 'Session expired. Please log in.' });
      }
      return res.redirect(loginPath);
    }
    const session = await auth.getSession(token);
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
  } catch (err) {
    console.error('Auth error:', err);
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ error: 'Session error. Please log in.' });
    }
    return res.redirect('/login');
  }
};

const requireRole = (role, insufficientPath) => async (req, res, next) => {
  try {
    const token = req.cookies.session_token;
    if (!token) {
      // Not logged in
      if (req.url.startsWith('/api/')) {
        return res.status(401).json({ error: 'Session expired. Please log in.' });
      }
      return res.redirect('/login');
    }
    const session = await auth.getSession(token);
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
  } catch (err) {
    console.error('Auth error:', err);
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ error: 'Session error. Please log in.' });
    }
    return res.redirect('/login');
  }
};

const protect = (req, res, next) => {
  // Allow access to login pages and insufficient permissions page
  if (req.url.startsWith('/login') || req.url.startsWith('/dash/login') || req.url.startsWith('/insufficient-permissions')) {
    return next();
  }

  // Dashboard routes require admin role
  if (req.url.startsWith('/dash') || req.url.startsWith('/api/dashboard')) {
    const token = req.cookies.session_token;
    if (!token) {
      return res.redirect('/login');
    }
    auth.getSession(token).then(session => {
      if (session && session.role === 'admin') {
        req.session = session;
        next();
      } else {
        res.redirect('/insufficient-permissions');
      }
    }).catch(err => {
      console.error('Auth error:', err);
      res.redirect('/login');
    });
    return;
  }

  // Admin routes require authentication
  if (req.url.startsWith('/admin')) {
    const token = req.cookies.session_token;
    if (!token) {
      return res.redirect('/login');
    }
    auth.getSession(token).then(session => {
      if (session) {
        req.session = session;
        next();
      } else {
        res.redirect('/login');
      }
    }).catch(err => {
      console.error('Auth error:', err);
      res.redirect('/login');
    });
    return;
  }

  // Allow other routes
  return next();
};
app.use(protect);

// --- Static Files ---
app.use('/dash/login', express.static(path.join(__dirname, 'public', 'dash', 'login')));

// --- API Routes ---
app.use('/api/dashboard', dashboardLimiter); // Dashboard limiter FIRST
// app.use('/api/login', loginLimiter); // Disabled for testing
// app.use('/api', apiLimiter); // General limiter LAST

// --- API Routes ---
app.use('/api/dashboard', dashboardLimiter); // Dashboard limiter FIRST
app.use('/api/login', loginLimiter); // Login limiter
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

// --- Health Check Route ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Vector DB Health Check ---
app.get('/api/vector-health', async (req, res) => {
  try {
    const vectorStore = require('./lib/vectorStore');
    if (vectorStore.store) {
      const test = await vectorStore.similaritySearch('test', 1);
      res.json({ status: 'ok', connected: true });
    } else {
      res.json({ status: 'disabled' });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// --- Prometheus Metrics ---
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// --- Root Route ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Protected Static Files ---
app.use('/admin', async (req, res, next) => {
  const token = req.cookies.session_token;
  const session = token && await auth.getSession(token);
  if (session) {
    return next();
  }
  res.redirect('/login/login.html');
}, express.static(path.join(__dirname, 'public', 'admin')));

// --- Favicon & 404 ---
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// --- Server Start ---
const serverCallback = async () => {
  // Auth sessions and dashboard tables are now handled by Prisma schema
  // Removed manual table creation scripts as Prisma manages the schema

  // Connect to database
  try {
    await prisma.$connect();
    console.log('✓ Database connection established');

    // Create schema if tables don't exist (for SQLite)
    try {
      await prisma.users.count();
    } catch (error) {
      if (error.code === 'P2021') { // Table does not exist
        console.log('Database tables not found, creating schema...');
        execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
        console.log('✓ Database schema created');
      } else {
        throw error;
      }
    }

    // Create default admin user if no users exist
    const userCount = await prisma.users.count();
    if (userCount === 0) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      await prisma.users.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          role: 'admin',
        },
      });
      console.log('✓ Default admin user created (username: admin, password: admin)');
    }

    // Build main CSS if source files changed
    const mainCssSrc = path.join(__dirname, 'src', 'main.css');
    const mainCssOut = path.join(__dirname, 'public', 'css', 'tailwind.css');
    try {
      const srcStat = fs.statSync(mainCssSrc);
      const outStat = fs.existsSync(mainCssOut) ? fs.statSync(mainCssOut) : { mtime: 0 };
      if (!fs.existsSync(mainCssOut) || srcStat.mtime > outStat.mtime) {
        console.log('Main CSS source changed, rebuilding...');
        execSync('npm run build:main-css', { stdio: 'inherit' });
        console.log('✓ Main CSS rebuilt');
      }
    } catch (error) {
      console.log('Warning: Could not check/rebuild main CSS:', error.message);
    }
  } catch (error) {
    console.error('Warning: Could not connect to database:', error.message);
  }

   // Sync vector DB if enabled
   if (process.env.SYNC_ON_START === 'true') {
     try {
       const vectorStore = require('./lib/vectorStore');
       await vectorStore.syncFromDB();
       console.log('✓ Vector DB synced on startup');
     } catch (error) {
       console.error('Warning: Could not sync vector DB:', error.message);
     }
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

if (!cliMode && !isTest) {
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
