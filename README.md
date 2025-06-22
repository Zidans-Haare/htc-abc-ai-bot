# HTC ABC AI Bot

This project provides a simple Node.js server that exposes an API endpoint for answering questions using the Gemini API.

## Environment Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
   Ensure that Node.js (version 18 or newer) and npm are available on your machine.

2. **Configuration**
   Create a `.env` file in the project root containing the API key for the Gemini API and an optional port:
   ```env
   API_KEY=your-google-api-key
   PORT=3000 # optional, defaults to 3000
   ADMIN_PASSWORD=tommy123
   ```

## Running `server.cjs`

Start the application with:
```bash
node server.cjs
```
Alternatively you can run `npm start`. When running on systems like all-inkl.com you may want to start the process in the background:
```bash
nohup node server.cjs &
```
The server writes its process id to `server.pid` so you can stop it using:
```bash
kill -9 $(cat server.pid)
```

The server listens on `/api/chat` for POST requests and serves the static files from the `public` directory.

## Handling Unanswered Questions

If the Gemini API responds with
"Diese Frage kann basierend auf den bereitgestellten Informationen nicht beantwortet werden",
this question is logged to `ai_fragen/offene_fragen.txt` for later review.
The log entry includes a timestamp and the original prompt.

## Verwalten unbeantworteter Fragen

Zur Auflistung aller noch offenen Fragen kann `GET /api/unanswered` verwendet werden. Eine Antwort 
kann – zusammen mit der ursprünglichen Frage – 
mittels `POST /api/answer` im JSON-Body übermittelt werden. Eine einfache Administrationsoberfläche
befindet sich unter `public/Admin/index.html` und ist per HTTP-Basic-Auth durch das in
`ADMIN_PASSWORD` gesetzte Passwort geschützte Verzeichnis zugänglich. Standardmäßig ist das Passwort `tommy123`.
