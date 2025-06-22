// run on all-inkl.com:
// 	$ nohup node server.cjs &
// kill 
//	$ kill -9 $(cat server.pid) 
// restart
//	$ kill -9 $(cat server.pid) ; sleep 1 ; nohup node server.cjs &

const fs = require('fs');
const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const { generateResponse, Conversation } = require("./controllers/geminiController.cjs");
const path = require("path");

const pid = process.pid;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// workaround for all-inkl.com webhost. the jsnode server seems to inject /components/ into the request url (unknown reason).
app.use((req, res, next) => {
  if (req.url.startsWith("/components/")) {
    req.url = req.url.replace(/^\/components/, "");
    console.log(`Rewrote URL to: ${req.url}`);
  }
  next();
});


// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Headers:", req.headers);
  console.log("Base URL:", req.baseUrl, "Path:", req.path);
  next();
});

// API Endpoints
app.post("/api/chat", generateResponse);

// List all stored conversation threads
app.get("/api/threads", async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
      attributes: ['conversationId', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    const threads = conversations.map(c => ({
      conversationId: c.conversationId,
      createdAt: c.createdAt
    }));
    res.json(threads);
  } catch (err) {
    console.error('Failed to fetch threads:', err.message);
    res.status(500).json({ error: 'Unable to fetch threads' });
  }
});

// Fetch messages for a specific conversation
app.get("/api/threads/:id", async (req, res) => {
  try {
    const convo = await Conversation.findOne({ where: { conversationId: req.params.id } });
    if (!convo) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ conversationId: convo.conversationId, messages: convo.messages });
  } catch (err) {
    console.error('Failed to fetch conversation:', err.message);
    res.status(500).json({ error: 'Unable to fetch conversation' });
  }
});

// Return list of unanswered questions
app.get('/api/unanswered', async (req, res) => {
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
app.post('/api/answer', async (req, res) => {
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

// Basic health check
//app.get("/", (req, res) => {
//  res.send("Gemini Assistant API is running");
//});

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
