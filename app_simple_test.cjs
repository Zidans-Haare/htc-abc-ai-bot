const fs = require('fs');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Node.js!');
});

server.listen(2000, '127.0.0.1', () => {
  const pid = process.pid;
  const apiKey = process.env.API_KEY || 'Not found';
  console.log(`Server running on port 2000, PID: ${pid}`);
//  console.log(`API_KEY: ${apiKey}`);
  // Save PID to file
  fs.writeFileSync('app_simple_test.pid', pid.toString(), (err) => {
    if (err) console.error('Error writing PID to app.pid:', err);
  });
});
