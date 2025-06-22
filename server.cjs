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
const { Op } = require('sequelize');
const path = require('path');

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


// Routes
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
  fs.writeFileSync('server.pid', pid.toString(), (err) => {
    if (err) console.error('Error writing PID to server.pid:', err);
  });
});
