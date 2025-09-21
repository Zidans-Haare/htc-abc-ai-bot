# HTW ABC AI Bot

Dieses Projekt ist eine Node.js-Anwendung, die einen KI-gestützten Chat-Assistenten über eine API bereitstellt. Es umfasst ein umfassendes Admin-Panel zur Verwaltung von Inhalten und ein Dashboard zur Überwachung von Analysen.

## ✨ Features

- **KI-Chat:** Eine öffentliche Schnittstelle (`/api/chat`), die Anfragen über das Gemini API von Google beantwortet.
- **Admin-Panel:** Eine passwortgeschützte Weboberfläche zur Verwaltung von Hochschul-ABC-Einträgen, Benutzern, Bildern und zur Überprüfung von Feedback.
- **Dashboard:** Ein separates, geschütztes Dashboard zur Anzeige von Nutzungsstatistiken und Anwendungsdaten.
- **Sicherheit:** Die Anwendung verwendet `helmet` zur Absicherung von HTTP-Headern und `express-rate-limit` zum Schutz vor Brute-Force-Angriffen.
- **Authentifizierung:** Admin- und Dashboard-Bereiche sind durch eine sitzungsbasierte Authentifizierung geschützt.

## 💻 Technologie-Stack

- **Backend:** Node.js, Express.js
- **Datenbank:** SQLite mit Sequelize ORM
- **Frontend:** Statisches HTML, CSS und JavaScript
- **KI:** Google Gemini API

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
    Erstellen Sie eine `.env`-Datei im Projektstammverzeichnis. Diese Datei sollte Ihren API-Schlüssel für die Gemini API und optional einen Port für den Server enthalten.

    ```env
    GEMINI_API_KEY=your-google-api-key
    PORT=3000 # Optional, Standard ist 3000
    ```

## ▶️ Anwendung starten

Führen Sie den folgenden Befehl im Projektverzeichnis aus, um den Server zu starten:

```bash
npm start
```

Oder direkt:

```bash
node server.cjs
```

Der Server schreibt seine Prozess-ID in die Datei `server.pid`, sodass Sie ihn bei Bedarf gezielt beenden können:

```bash
# Für Linux/macOS
kill -9 $(cat server.pid)
```

### Start-Optionen

-   `-https`: Startet den Server im HTTPS-Modus. Erfordert, dass `key.pem` und `cert.pem` in Ihrem `.ssh`-Verzeichnis im Home-Ordner vorhanden sind.
-   `-admin`: Startet den Server in einem Debug-Modus, der die Authentifizierung für die Admin- und Dashboard-Bereiche umgeht. **Nur für Entwicklungszwecke verwenden.**

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
