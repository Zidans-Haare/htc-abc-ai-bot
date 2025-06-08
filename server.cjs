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
const { generateResponse } = require("./controllers/geminiController.cjs");
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
