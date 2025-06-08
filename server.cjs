const fs = require('fs');


const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const { generateResponse } = require("./controllers/geminiController.cjs");
const pid = process.pid;


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

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

// Basic health check
app.get("/", (req, res) => {
  res.send("Gemini Assistant API is running");
});

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
    if (err) console.error('Error writing PID to app.pid:', err);
  });

});
