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
   ADMIN_TOKEN=htw123
   ```

   Requests to admin endpoints (e.g. `/api/admin/*`, `/api/answer`, `/api/update`)
   must include this token in the `Authorization` header as `Bearer <token>`.

   The admin interface in `public/admin2/` uses the token `htw123` by default.
   Make sure the `ADMIN_TOKEN` in your `.env` matches this value or adjust the
   `AUTH_TOKEN` constant in `public/admin2/admin.js` accordingly.

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
befindet sich unter `public/admin.html`.

## Admin2 Interface

The folder `public/admin2/` contains a more modern interface for editing the
content of the Hochschul‑ABC. Open `public/admin2/index.html` in a browser or
visit `/admin2/` on the running server to use it.

### API routes

The page communicates with several JSON endpoints:

* `GET /api/admin/headlines` – list headlines of all **active** entries. The response
  also includes the text of each entry so the admin interface can search
  through both headline and content.
* `GET /api/admin/entries/:id` – retrieve a single entry by id.
* `POST /api/admin/entries` – create a new entry. Provide `headline` and `text`
  in the request body.
* `PUT /api/admin/entries/:id` – update an entry. The previous version is marked
  as inactive and timestamped in the `archived` field while a new record is
  created and returned.
* `DELETE /api/admin/entries/:id` – archive an entry by setting `active` to
  `false` and recording the time in `archived`.
* `GET /api/admin/archive` – return all archived entries ordered by the time they
  were archived.

Only active records are served by the API. Archived entries remain in the
database for reference and history tracking.

If the unanswered‑question workflow from `public/admin.html` is added to this
interface, you can review questions logged in
`ai_fragen/offene_fragen.txt` and submit answers via `/api/answer`.
