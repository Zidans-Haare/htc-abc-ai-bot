# HTW ABC AI Bot

Dieses Projekt ist eine Node.js-Anwendung, die einen KI-gestützten Chat-Assistenten über eine API bereitstellt. Es umfasst ein umfassendes Admin-Panel zur Verwaltung von Inhalten und ein Dashboard zur Überwachung von Analysen.

## ✨ Features

- **KI-Chat:** Eine öffentliche Schnittstelle (`/api/chat`), die Anfragen über einen OpenAI-kompatiblen Endpoint (z. B. KISSKI Chat AI) beantwortet.
- **Admin-Panel:** Eine passwortgeschützte Weboberfläche zur Verwaltung von Hochschul-ABC-Einträgen, Benutzern, Bildern und zur Überprüfung von Feedback.
- **Dashboard:** Ein separates, geschütztes Dashboard zur Anzeige von Nutzungsstatistiken und Anwendungsdaten.
- **Sicherheit:** Die Anwendung verwendet `helmet` zur Absicherung von HTTP-Headern und `express-rate-limit` zum Schutz vor Brute-Force-Angriffen.
- **Authentifizierung:** Admin- und Dashboard-Bereiche sind durch eine sitzungsbasierte Authentifizierung geschützt.

## 💻 Technologie-Stack

- **Backend:** Node.js, Express.js
- **Datenbank:** SQLite (Standard) über Prisma ORM; optional PostgreSQL/MySQL via `DATABASE_URL`
- **Frontend:** Statisches HTML, CSS und JavaScript
- **KI:** OpenAI-kompatible API (z. B. KISSKI Chat AI)

## 🚀 Setup & Konfiguration

### Voraussetzungen

- Node.js (Version 18 oder neuer)
- npm (wird mit Node.js installiert)

### Installation

1.  **Abhängigkeiten installieren:**
    ```bash
    npm install
    ```

2.  **Konfiguration:**
    Erstellen Sie eine `.env`-Datei im Projektstammverzeichnis. Hinterlegen Sie dort Ihren Bearer-Token (oder API-Key) sowie optional Basis-URL, Modell und Port.

    ```env
    # AI Chat Configuration
    CHAT_AI_TOKEN=dein-bearer-token      # Bearer token for AI API (alternativ: OPENAI_API_KEY oder KISSKI_API_KEY)
    OPENAI_BASE_URL=https://chat-ai.academiccloud.de/v1  # Base URL for OpenAI-compatible API
    OPENAI_MODEL=meta-llama-3.1-8b-instruct  # Model to use for AI responses

    # Server Configuration
    PORT=3000  # Server port (default: 3000)
    TRUST_PROXY_COUNT=2  # Number of proxy layers (e.g., Cloudflare + Nginx)

    # Main Database Configuration
    MAIN_DB_TYPE=sqlite  # Main DB type: 'sqlite', 'postgresql', or 'mysql' (default: sqlite)
    MAIN_DB_PATH=hochschuhl-abc.db  # SQLite file path (only if MAIN_DB_TYPE=sqlite)
    # For PostgreSQL/MySQL (uncomment and set if MAIN_DB_TYPE is not 'sqlite')
    # MAIN_DB_HOST=localhost  # DB host
    # MAIN_DB_PORT=5432  # DB port (5432 for PostgreSQL, 3306 for MySQL)
    # MAIN_DB_USER=myuser  # DB username
    # MAIN_DB_PASSWORD=mypassword  # DB password
    # MAIN_DB_NAME=mydb  # DB name
    # MAIN_DB_SSL=false  # Enable SSL: 'true' or 'false' (default: false)

    # Session Authentication
    SESSION_INACTIVITY_TIMEOUT_MINUTES=1440  # Time in minutes after last activity before session expires (default: 1440 for 24 hours). Also sets client-side cookie expiration.
    SESSION_MAX_DURATION_MINUTES=43200  # Maximum session duration in minutes from creation (default: 43200 for 30 days).

    # Vector Database Configuration
    VECTOR_DB_TYPE=none  # Vector DB type: 'none', 'chroma', or 'weaviate' (default: none)
    CHROMA_URL=  # Required if VECTOR_DB_TYPE=chroma
    CHROMA_COLLECTION=  # Required if VECTOR_DB_TYPE=chroma
    WEAVIATE_URL=  # Required if VECTOR_DB_TYPE=weaviate
    WEAVIATE_COLLECTION=  # Required if VECTOR_DB_TYPE=weaviate

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
npm start
```

- `npm run build` erstellt einmalig das Bundle unter `dist/`.
- `npm start` startet den Express-Server in der Standardkonfiguration. Nutzen Sie einen Prozess-Manager (z. B. systemd, pm2) für den Dauerbetrieb.
- Optional `npm start -- -dev`, um serverseitiges Caching zu deaktivieren (z. B. für Tests in einer Staging-Umgebung).

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
