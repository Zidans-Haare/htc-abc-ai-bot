# HTW ABC AI Bot

Dieses Projekt ist eine Node.js-Anwendung, die einen KI-gestützten Chat-Assistenten über eine API bereitstellt. Es umfasst ein umfassendes Admin-Panel zur Verwaltung von Inhalten und ein Dashboard zur Überwachung von Analysen.

## ✨ Features

- **KI-Chat:** Eine öffentliche Schnittstelle (`/api/chat`), die Anfragen über verschiedene KI-Provider (ChatAI, Google Gemini, Claude, XAI) beantwortet.
- **Admin-Panel:** Eine passwortgeschützte Weboberfläche zur Verwaltung von Hochschul-ABC-Einträgen, Benutzern, Bildern und zur Überprüfung von Feedback.
- **Dashboard:** Ein separates, geschütztes Dashboard zur Anzeige von Nutzungsstatistiken und Anwendungsdaten.
- **Sicherheit:** Die Anwendung verwendet `helmet` zur Absicherung von HTTP-Headern und `express-rate-limit` zum Schutz vor Brute-Force-Angriffen.
- **Authentifizierung:** Admin- und Dashboard-Bereiche sind durch eine sitzungsbasierte Authentifizierung geschützt.

## 💻 Technologie-Stack

- **Backend:** Node.js, Express.js
- **Datenbank:** SQLite (Standard) über Prisma ORM; optional PostgreSQL/MySQL via `DATABASE_URL`
- **Frontend:** Statisches HTML, CSS und JavaScript
- **KI:** Mehrere Provider (ChatAI, Google Gemini, Anthropic Claude, XAI)

## 🚀 Setup & Konfiguration

### Voraussetzungen

- Node.js (Version 18 oder neuer)
- npm (wird mit Node.js installiert)

### Installation

1.  **Abhängigkeiten installieren:**

    Für grundlegende Funktionalität (ohne KI-Provider, Vektor-DBs usw.):
    ```bash
    npm install --production --no-optional
    ```

    Für vollständige Installation (mit allen optionalen Abhängigkeiten):
    ```bash
    npm install
    ```

    **Optionale Abhängigkeiten:** Die folgenden Pakete werden nur installiert, wenn die entsprechenden Features verwendet werden (z. B. über Umgebungsvariablen):
    - `@google/generative-ai`: Für Google Gemini (wenn `AI_PROVIDER=google`).
    - `@anthropic-ai/sdk`: Für Anthropic Claude (wenn `AI_PROVIDER=claude`).
    - `@huggingface/transformers`: Für Hugging Face Embeddings (wenn `EMBEDDING_LIBRARY=huggingface`).
    - `@langchain/community`: Für LangChain-Community-Integrationen.
    - `@langchain/core`: Kernbibliothek für LangChain.
    - `@langchain/openai`: LangChain-Integration für OpenAI.
    - `@langchain/textsplitters`: Textaufteilung für LangChain.
    - `@xenova/transformers`: Für Xenova Embeddings (wenn `EMBEDDING_LIBRARY=xenova`).
    - `chromadb`: Für ChromaDB als Vektor-Datenbank (wenn `VECTOR_DB_TYPE=chroma`).
    - `langchain`: LangChain-Bibliothek.
    - `mysql2`: Für MySQL-Datenbank (wenn `MAIN_DB_TYPE=mysql`).
    - `openai`: Offizielle OpenAI-API-Bibliothek (wenn `AI_PROVIDER=openai`).
    - `pg`: Für PostgreSQL-Datenbank (wenn `MAIN_DB_TYPE=postgresql`).
    - `weaviate-client`: Für Weaviate als Vektor-Datenbank (wenn `VECTOR_DB_TYPE=weaviate`).

2.  **Konfiguration:**
    Erstellen Sie eine `.env`-Datei im Projektstammverzeichnis. Hinterlegen Sie dort Ihren Bearer-Token (oder API-Key) sowie optional Basis-URL, Modell und Port.

    ```env
    # AI Chat Configuration
    AI_PROVIDER=chatAi  # 'chatAi' (university), 'openai' (official OpenAI), 'google', 'claude', 'xai'
    AI_API_KEY=dein-api-key  # API key for the selected provider. Required.
    AI_BASE_URL=https://chat-ai.academiccloud.de/v1  # Base URL for 'chatAi' or 'xai' (optional)
    AI_MODEL=meta-llama-3.1-8b-instruct  # Model name (generic, or provider-specific)
    AI_TEMPERATURE=0.2  # Temperature for responses (0-2)
    AI_MAX_TOKENS=1000  # Max tokens per response
    AI_STREAMING=true  # Enable streaming

    # Provider-specific overrides (optional)
    AI_OPENAI_API_KEY=...  # For official OpenAI
    AI_GOOGLE_API_KEY=...  # For Google Gemini
    AI_CLAUDE_API_KEY=...  # For Anthropic Claude
    AI_XAI_API_KEY=...  # For XAI

    # Server Configuration
    PORT=3000  # Server port (default: 3000)
    TRUST_PROXY_COUNT=2  # Number of proxy layers (e.g., Cloudflare + Nginx)

    # Main Database Configuration
    DATABASE_URL="file:/home/htw/htc-abc-ai-bot/hochschuhl-abc.db"  # SQLite (default)
    # DATABASE_URL="postgresql://username:password@localhost:5432/dbname?schema=public"  # PostgreSQL example
    # DATABASE_URL="mysql://username:password@localhost:3306/dbname"  # MySQL example

    # Session Authentication
    SESSION_INACTIVITY_TIMEOUT_MINUTES=1440  # Time in minutes after last activity before session expires (default: 1440 for 24 hours). Also sets client-side cookie expiration.
    SESSION_MAX_DURATION_MINUTES=43200  # Maximum session duration in minutes from creation (default: 43200 for 30 days).

    # Vector Database Configuration
    VECTOR_DB_TYPE=none  # Vector DB type: 'none', 'chroma', or 'weaviate' (default: none)
    CHROMA_URL=  # Required if VECTOR_DB_TYPE=chroma
    CHROMA_COLLECTION=  # Required if VECTOR_DB_TYPE=chroma
    WEAVIATE_URL=  # Required if VECTOR_DB_TYPE=weaviate
    WEAVIATE_COLLECTION=  # Required if VECTOR_DB_TYPE=weaviate

3.  **Datenbank-Initialisierung:**
     Die Anwendung verwendet Prisma für die Datenbankverwaltung. Beim ersten Start wird die Datenbank automatisch mit Tabellen und Views erstellt. Bei Versionsänderungen (z. B. nach Schema-Updates) werden Migrationen automatisch angewendet.

     - **Neue Datenbank:** Wenn keine `hochschuhl-abc.db` vorhanden ist, führt die Anwendung `prisma migrate reset` aus, um die Datenbank mit allen Tabellen und Views zu initialisieren.
     - **Versionsänderungen:** Bei Änderungen der App-Version (in `package.json`) oder fehlender Versionsverfolgung wird `prisma migrate deploy` ausgeführt, um ausstehende Migrationen anzuwenden.
     - **Manuelle Migration:** Für manuelle Anpassungen verwenden Sie `npx prisma migrate dev --name beschreibung`.

4.  **Server starten:**
    Für Produktion ist PM2 der empfohlene Weg, um den Server zu starten und Änderungen an `.env` automatisch zu überwachen und neu zu starten.

    ```bash
    # Zuerst das Projekt bauen
    npm run build

    # Dann mit PM2 starten (überwacht .env für Änderungen)
    pm2 start ecosystem.config.js
    ```

    Dies stellt sicher, dass der Server bei Änderungen an Umgebungsvariablen (z. B. `VECTOR_DB_TYPE=chroma`) automatisch neu startet, ohne manuelles Eingreifen. PM2 begrenzt automatische Neustarts bei Abstürzen auf 30 Versuche mit 5 Sekunden Verzögerung; manuelle oder watch-basierte Neustarts sind unbegrenzt.

    Für Entwicklung:
    ```bash
    npm run dev:watch
    ```
    Dies startet den Server mit Hot-Reload für Code- und `.env`-Änderungen.

    Für Tests:
    ```bash
    npm test
    ```
    Führt die Testsuite aus (interaktiv oder direkt).
    USE_VECTOR_IMAGES=static  # Image list mode for AI: 'static' (default, from DB), 'simple' (from vector DB), 'dynamic' (per-query from vector DB)

    # Vector DB Processing Options
    CHUNK_SIZE=500  # Size of text chunks for vectorization (200-1000, default: 500)
    CHUNK_OVERLAP=50  # Overlap between chunks (0-200, default: 50)
    RETRIEVE_K=3  # Number of similar chunks to retrieve (1-10, default: 3)
    MIN_SIMILARITY=0.7  # Minimum similarity score for retrieval (0-1, default: 0.7)
    EMBEDDING_LIBRARY=xenova  # Embedding library: 'xenova' (default, uses @xenova/transformers) or 'huggingface' (uses @huggingface/transformers)
    SYNC_ON_START=false  # Sync vector DB on startup: 'true' or 'false' (default: false)
    ENABLE_GRAPHRAG=false  # Enable graph-based retrieval: 'true' or 'false' (default: false)

    # PDF Processing Options
    PDF_CHUNK_SIZE=300  # Chunk size for PDF text (100-1000, default: 300)
    PDF_EXTRACT_TEXT_ONLY=false  # Extract only text from PDFs: 'true' or 'false' (default: false)
    SYNC_BATCH=100  # Batch size for vector DB sync (10-500, default: 100)
    DISPLAY_TOKEN_USED_FOR_QUERY=false  # Display token usage in responses: 'true' or 'false' (default: false)

    # Image Handling Options
    # The AI can reference images in responses. Configure how the image list is generated for the AI prompt.
    # - 'static': Fetch from main DB (Prisma). Fast, no vector DB required. Includes all images with descriptions.
    # - 'simple': Fetch from vector DB. Uses embeddings for retrieval, may improve relevance but adds latency.
    # - 'dynamic': Query vector DB per user question. Most adaptive, but highest latency and token usage.
    # Requires VECTOR_DB_TYPE != 'none' for 'simple'/'dynamic'. Fallbacks to 'static' if vector DB fails.

    # Embedding Models (known working models with dimensions)
    # For EMBEDDING_LIBRARY=xenova (default):
    # - all-MiniLM-L6-v2 (384 dimensions)
    # - paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions)
    # For EMBEDDING_LIBRARY=huggingface:
    # - onnx-community/Qwen3-Embedding-0.6B-ONNX (1024 dimensions)
    # - sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
    ```

## ▶️ Anwendung starten

### Entwicklung (Watcher-Bundle)

```bash
npm run dev:watch
```

- Baut das Frontend kontinuierlich (`vite build --watch`) und startet den Express-Server mit `nodemon`.
- Änderungen in `src/` erzeugen sofort ein neues Bundle; Änderungen unter `server/` lösen einen automatischen Neustart aus.
- Die Anwendung läuft anschließend unter `http://127.0.0.1:3000/`. Hot Module Reloading ist nicht notwendig, weil die neu gebauten Assets direkt von Express ausgeliefert werden.

### Produktion / Staging

```bash
npm run build
pm2 start ecosystem.config.js
```

- `npm run build` erstellt einmalig das Bundle unter `dist/`.
- `pm2 start ecosystem.config.js` startet den Express-Server mit PM2, welcher Änderungen an `.env` überwacht und automatisch neu startet. Für Dauerbetrieb und automatische Neustarts bei Umgebungsvariablen-Änderungen empfohlen.
- Alternativ `npm start` für einfache Starts ohne PM2, aber ohne automatische `.env`-Überwachung.

### Nginx-Konfiguration (Beispiel für dev.olomek.com)

Für die Produktionsumgebung kann Nginx als Reverse-Proxy verwendet werden. Hier ein Beispiel für die Konfiguration in `/etc/nginx/sites-available/dev`:

```nginx
server {
    listen 80;
    server_name dev.olomek.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dev.olomek.com;

    ssl_certificate     /etc/nginx/ssl/origin.crt;
    ssl_certificate_key /etc/nginx/ssl/origin.key;
    include snippets/ssl-params.conf;

    # Disable separate route to uploads, because marginal gains vs complexity
    # location /uploads/ {
    #    alias /home/htw/htc-abc-ai-bot/uploads/;
    #    add_header Cache-Control "no-cache";
    # }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Diese Konfiguration leitet HTTP-Anfragen auf HTTPS um und proxied alle Anfragen an den lokalen Express-Server auf Port 3000.

## 🔐 Authentifizierung

Der Zugriff auf das Admin-Panel (`/admin/`) und das Dashboard (`/dash/`) erfordert eine Anmeldung. Die Anwendung verwendet ein In-Memory-Session-Management.

-   **Wichtiger Hinweis:** Da die Sitzungen im Speicher gehalten werden, gehen alle Anmeldungen verloren, wenn der Server neu gestartet wird.
-   Ein Standardbenutzer `admin` mit dem Passwort `admin` wird beim ersten Start und der Initialisierung der Datenbank angelegt.

## 📁 Projektstruktur

```
.
├── controllers/     # Anwendungslogik (API-Endpunkte, Datenbankinteraktionen)
├── logs/            # Log-Dateien (z.B. audit.log)
├── public/          # Statische Dateien (HTML, CSS, JS für Frontend, Admin, Dashboard)
├── scripts/         # Skripte für Datenbankmigration und -initialisierung
├── utils/           # Hilfsfunktionen (z.B. Caching, Tokenizer)
├── .env             # Konfigurationsdatei (muss manuell erstellt werden)
├── package.json     # Projektabhängigkeiten und Skripte
└── server.cjs       # Hauptanwendungsdatei (Server-Setup, Middleware, Routen)
```

## 📝 API-Endpunkte (Übersicht)

Die Anwendung stellt verschiedene API-Endpunkte bereit:

-   **Öffentliche API:**
    -   `POST /api/chat`: Sendet eine Anfrage an den KI-Chatbot.
    -   `GET /api/suggestions`: Ruft Vorschläge für den Chat ab.
-   **Admin-API (`/api/admin/`):**
    -   Endpunkte zur Verwaltung von Einträgen, Benutzern, Feedback, Bildern und mehr. Erfordert Authentifizierung.
-   **Dashboard-API (`/api/dashboard/`):**
    -   Endpunkte zur Bereitstellung von Daten für das Monitoring-Dashboard. Erfordert Authentifizierung.
-   **Authentifizierungs-API:**
    -   `POST /api/login`: Authentifiziert einen Benutzer und startet eine Sitzung.
    -   `POST /api/logout`: Beendet die aktuelle Sitzung.

## 🛡️ Sicherheit

-   **Helmet:** Schützt die Anwendung durch das Setzen verschiedener sicherheitsrelevanter HTTP-Header.
-   **Rate Limiting:** Begrenzt die Anzahl der Anfragen an die API, um Missbrauch zu verhindern. Für die Anmelde-Endpunkte gelten strengere Limits.

## 🪵 Logging

Benutzeraktionen im Admin-Panel (wie Anmeldungen, Inhaltserstellung und -löschung) werden in der Datei `logs/audit.log` protokolliert, um die Nachverfolgbarkeit zu gewährleisten.

## 🧪 Tests

Die Anwendung enthält Unit- und Integrationstests mit Jest.

- **Tests ausführen (interaktiv wählen .env oder .env.test, defaults to .env in 10s):**
  ```bash
  npm test
  ```

- **Tests direkt mit Jest (ohne Prompt, verwendet .env):**
  ```bash
  npm run test:direct
  ```

- **Tests mit Test-Umgebungsvariablen (.env.test):**
  ```bash
  npm run test:env
  ```

- **Testabdeckung generieren:**
  ```bash
  npm run test:coverage
  ```

Stellen Sie sicher, dass `.env` oder `.env.test` vorhanden ist. Die Tests prüfen nur konfigurierte optionale Abhängigkeiten (z. B. nur ChromaDB, wenn `VECTOR_DB_TYPE=chroma` gesetzt ist).

## 🔧 Troubleshooting

- **Server startet nicht:** Überprüfen Sie die `.env`-Datei auf korrekte Konfiguration (z. B. `AI_API_KEY`, `DATABASE_URL`).
- **Datenbankfehler:** Führen Sie `npx prisma migrate dev` aus, um Migrationen anzuwenden.
- **Vite-Dev-Server:** Verwenden Sie `timeout 10s npm run dev` für Tests, um Blockierungen zu vermeiden.
- **Nginx-Proxy:** Stellen Sie sicher, dass Nginx auf IPv4 bindet (`127.0.0.1:3000`), um 502-Fehler zu vermeiden.
- **Vector DB Sync:** Bei Problemen mit der Vektor-Datenbank führen Sie `node scripts/migrate_to_prisma.js` aus, um alte Daten zu migrieren.

Für detaillierte Logs prüfen Sie `logs/audit.log` und Konsolen-Ausgaben.
