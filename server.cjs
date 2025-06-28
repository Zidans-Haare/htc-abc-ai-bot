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
const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const { generateResponse } = require("./controllers/geminiController.cjs");
const { getHeadlines, getEntry, createEntry, updateEntry, deleteEntry } = require("./controllers/adminController.cjs");
const path = require('path');
const { Sequelize } = require('sequelize');
const ConversationModel = require('./models/Conversation');

const pid = process.pid;

dotenv.config();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Setup database connection for conversation threads
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './chatbot.db',
  logging: false
});

const Conversation = ConversationModel(sequelize);

// Ensure database tables exist
sequelize.sync({ alter: true })
  .catch(err => console.error('SQLite sync error:', err.message));

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

function adminAuth(req, res, next) {
  if (!ADMIN_TOKEN) return next();
  const header = req.headers['authorization'] || '';
  if (header === `Bearer ${ADMIN_TOKEN}`) {
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
app.post("/api/chat", generateResponse);

// List conversation threads
app.get('/api/threads', async (req, res) => {
  try {
    const convos = await Conversation.findAll({
      order: [['updatedAt', 'DESC']]
    });
    const threads = convos.map(c => ({
      conversationId: c.conversationId,
      title: (c.messages && c.messages.length)
        ? c.messages.find(m => m.isUser)?.text?.slice(0, 50) || ''
        : ''
    }));
    res.json(threads);
  } catch (err) {
    console.error('Failed to load threads:', err);
    res.status(500).json({ error: 'Failed to load threads' });
  }
});

// Get a specific conversation by ID
app.get('/api/threads/:id', async (req, res) => {
  try {
    const convo = await Conversation.findOne({ where: { conversationId: req.params.id } });
    if (!convo) return res.status(404).json({ error: 'Not found' });
    res.json({
      conversationId: convo.conversationId,
      messages: convo.messages
    });
  } catch (err) {
    console.error('Failed to load conversation:', err);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
});

// Return list of unanswered questions
app.get('/api/unanswered', adminAuth, async (req, res) => {
  try {
    const file = path.resolve(__dirname, 'ai_fragen/offene_fragen.txt');
    const data = await fs.promises.readFile(file, 'utf8');
    const questions = data
      .split(/\n+/)
      .filter(Boolean)
      .map(line => {
        const match = line.match(/Frage:\s*(.*)$/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean);
    res.json(questions);
  } catch (err) {
    console.error('Failed to read unanswered questions:', err);
    res.status(500).json({ error: 'Failed to read unanswered questions' });
  }
});

// Submit an answer for a question
app.post('/api/answer', adminAuth, async (req, res) => {
  const { question, answer } = req.body || {};
  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer required' });
  }

  try {
    const faqFile = path.resolve(__dirname, 'ai_input/faq.txt');
    const unansweredFile = path.resolve(__dirname, 'ai_fragen/offene_fragen.txt');

    // Append to FAQ file
    await fs.promises.appendFile(
      faqFile,
      `F:${question}\nA:${answer}\n`,
      'utf8'
    );

    // Remove the question from offene_fragen.txt
    const content = await fs.promises.readFile(unansweredFile, 'utf8');
    const updated = content
      .split(/\n+/)
      .filter(line => !line.includes(`Frage: ${question}`))
      .join('\n');
    await fs.promises.writeFile(unansweredFile, updated + (updated.endsWith('\n') ? '' : '\n'), 'utf8');

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to store answer:', err);
    res.status(500).json({ error: 'Failed to store answer' });
  }
});

// Return list of already answered questions
app.get('/api/answered', adminAuth, async (req, res) => {
  try {
    const faqFile = path.resolve(__dirname, 'ai_input/faq.txt');
    const data = await fs.promises.readFile(faqFile, 'utf8');
    const lines = data.split(/\n+/).filter(Boolean);
    const result = [];
    for (let i = 0; i < lines.length; i++) {
      const qMatch = lines[i].match(/^F:(.*)/);
      const aMatch = lines[i + 1] && lines[i + 1].match(/^A:(.*)/);
      if (qMatch && aMatch) {
        result.push({
          question: qMatch[1].trim(),
          answer: aMatch[1].trim()
        });
        i++; // skip next line
      }
    }
    res.json(result);
  } catch (err) {
    console.error('Failed to read answered questions:', err);
    res.status(500).json({ error: 'Failed to read answered questions' });
  }
});

// Update an existing answer
app.post('/api/update', adminAuth, async (req, res) => {
  const { question, answer } = req.body || {};
  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer required' });
  }
  try {
    const faqFile = path.resolve(__dirname, 'ai_input/faq.txt');
    const lines = (await fs.promises.readFile(faqFile, 'utf8')).split(/\n/);
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('F:') && lines[i].slice(2).trim() === question) {
        if (i + 1 < lines.length && lines[i + 1].startsWith('A:')) {
          lines[i + 1] = `A:${answer}`;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      return res.status(404).json({ error: 'Question not found' });
    }
    await fs.promises.writeFile(faqFile, lines.join('\n'), 'utf8');
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update answer:', err);
    res.status(500).json({ error: 'Failed to update answer' });
  }
});



// Admin routes Grok/thomas
app.use('/api/admin', adminAuth);
app.get("/api/admin/headlines", getHeadlines);
app.get("/api/admin/entries/:id", getEntry);
app.post("/api/admin/entries", createEntry);
app.put("/api/admin/entries/:id", updateEntry);
app.delete("/api/admin/entries/:id", deleteEntry);


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
