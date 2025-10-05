# ServerSetup

## 1. Basis-System vorbereiten
1. Systempakete aktualisieren
   - Befehl: `sudo apt update && sudo apt upgrade -y`
   - Grund: Haelt alle Pakete aktuell und schliesst bekannte Sicherheitsluecken.
2. Kern-Tools installieren
   - Befehl: `sudo apt install -y git build-essential ufw unzip python3 libvips sqlite3`
   - Grund: Git fuer den Code, Build-Tools und libvips fuer `sharp`, SQLite fuer die Datenbank sowie Basis-Utilities.
3. NodeSource-Repository fuer Node.js 18 einrichten
   - Befehl: `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -`
   - Grund: Bindet die offizielle NodeSource-Quelle ein, damit eine aktuelle Node.js-LTS-Version verfuegbar ist.
4. Node.js installieren
   - Befehl: `sudo apt install -y nodejs`
   - Grund: Installiert Node.js 18 und npm, die zum Betrieb der Anwendung benoetigt werden.
5. Installation pruefen
   - Befehl: `node -v && npm -v`
   - Grund: Bestaetigt, dass Node.js und npm korrekt eingerichtet wurden.
6. Dienstnutzer anlegen (optional, empfohlen)
   - Befehl: `sudo adduser --system --group --home /opt/htw-ai-bot htw-ai-bot`
   - Grund: Betreibt die Anwendung unter einem eigenen Systemnutzer mit minimalen Rechten.

## 2. GitHub SSH-Zugriff einrichten
1. SSH-Verzeichnis vorbereiten
   - Befehl: `mkdir -p ~/.ssh && chmod 700 ~/.ssh`
   - Grund: Legt den SSH-Konfigurationsordner an und setzt sichere Rechte.
2. SSH-Schluessel erzeugen
   - Befehl: `ssh-keygen -t ed25519 -C "deploy@htw-ai-bot"`
   - Grund: Erstellt ein modernes Schluesselpaar fuer die Authentifizierung bei GitHub (Dateipfad und Passphrase bei Bedarf anpassen).
3. Public Key anzeigen
   - Befehl: `cat ~/.ssh/id_ed25519.pub`
   - Grund: Zeigt den oeffentlichen Schluessel an, der im GitHub-Account unter Settings -> SSH keys hinterlegt werden muss.
4. Verbindung testen
   - Befehl: `ssh -T git@github.com`
   - Grund: Prueft, ob der Server sich erfolgreich bei GitHub authentifizieren kann (Hinweis bestaetigen, falls nach Known Host gefragt wird).

## 3. Projektdateien bereitstellen
1. Zielverzeichnis erstellen
   - Befehl: `sudo mkdir -p /opt/htw-ai-bot`
   - Grund: Legt den Installationspfad fuer die Anwendung an.
2. Besitzrechte setzen
   - Befehl: `sudo chown -R htw-ai-bot:htw-ai-bot /opt/htw-ai-bot`
   - Grund: Gewaehrt dem Dienstnutzer Schreibrechte im Projektverzeichnis.
3. Repository klonen
   - Befehl: `sudo -u htw-ai-bot git clone git@github.com:Zidans-Haare/htw-ai-bot.git /opt/htw-ai-bot/app`
   - Grund: Holt den Anwendungscode aus GitHub an den Zielort.
4. Manifest-Domain anpassen
   - Befehl: `sudo -u htw-ai-bot nano /opt/htw-ai-bot/app/public/manifest.json`
   - Grund: Setzt `start_url` auf die neue Produktionsdomain, damit PWA-Funktionen korrekt arbeiten.
5. HTTPS-Vertrauen aktivieren
   - Befehl: `sudo -u htw-ai-bot nano /opt/htw-ai-bot/app/server.cjs`
   - Grund: Ergaenzt im Express-Setup `app.set('trust proxy', 1);`, damit Cookies hinter Nginx als sicher markiert werden.

## 4. Umgebungsvariablen und Daten vorbereiten
1. `.env` anlegen
   - Befehl: `sudo -u htw-ai-bot nano /opt/htw-ai-bot/app/.env`
   - Grund: Hinterlegt Umgebungsvariablen wie `GEMINI_API_KEY`, `PORT=3000` und `NODE_ENV=production`.
2. Datenbankdatei setzen (falls Uebernahme)
   - Befehl: `sudo cp /pfad/zur/alten/hochschuhl-abc.db /opt/htw-ai-bot/app/hochschuhl-abc.db`
   - Grund: Uebertraegt bestehende Inhalte auf den neuen Server.
3. Rechte auf Datenbank und Verzeichnisse pruefen
   - Befehl: `sudo chown htw-ai-bot:htw-ai-bot /opt/htw-ai-bot/app/hochschuhl-abc.db`
   - Grund: Ermoeglicht dem Dienstnutzer Schreibzugriff auf die SQLite-Datei.
4. Upload- und Cache-Verzeichnisse anlegen
   - Befehl: `sudo -u htw-ai-bot mkdir -p /opt/htw-ai-bot/app/public/uploads /opt/htw-ai-bot/app/cache/uploads /opt/htw-ai-bot/app/logs`
   - Grund: Stellt sicher, dass fuer Bilddateien, Cache und Logs beschreibbare Pfade existieren.

## 5. Abhaengigkeiten installieren und Testlauf
1. Pakete installieren
   - Befehl: `sudo -u htw-ai-bot bash -lc "cd /opt/htw-ai-bot/app && npm ci"`
   - Grund: Installiert eine reproduzierbare Dependency-Landschaft fuer das Projekt.
2. Optionaler Funktionstest
   - Befehl: `sudo -u htw-ai-bot bash -lc "cd /opt/htw-ai-bot/app && npm start"`
   - Grund: Verifiziert lokal, dass der Server startet und keine Laufzeitfehler auftreten (anschliessend STRG+C).

## 6. Systemd-Dienst einrichten
1. Service-Datei erstellen
   - Befehl: `sudo nano /etc/systemd/system/htw-ai-bot.service`
   - Grund: Definiert, wie systemd die Anwendung als Dienst ausfuehrt.
2. Service-Konfiguration einfuegen
   - Inhalt:
     ```ini
     [Unit]
     Description=HTW AI Bot
     After=network.target

     [Service]
     Type=simple
     User=htw-ai-bot
     WorkingDirectory=/opt/htw-ai-bot/app
     EnvironmentFile=/opt/htw-ai-bot/app/.env
     ExecStart=/usr/bin/node /opt/htw-ai-bot/app/server.cjs
     Restart=on-failure

     [Install]
     WantedBy=multi-user.target
     ```
   - Grund: Stellt sicher, dass der Dienst unter dem richtigen Nutzer mit der .env startet.
3. Systemd neu einlesen
   - Befehl: `sudo systemctl daemon-reload`
   - Grund: Laedt die neue Service-Definition in systemd.
4. Dienst aktivieren und starten
   - Befehl: `sudo systemctl enable --now htw-ai-bot`
   - Grund: Startet den Bot sofort und sorgt dafuer, dass er nach Neustarts automatisch laeuft.
5. Status kontrollieren
   - Befehl: `sudo systemctl status htw-ai-bot`
   - Grund: Ueberprueft, ob der Dienst fehlerfrei laeuft.
6. Laufzeit-Logs beobachten
   - Befehl: `sudo journalctl -u htw-ai-bot -f`
   - Grund: Bietet Live-Einsicht in Logmeldungen waehrend des Betriebs.

## 7. Nginx als Reverse Proxy und HTTPS
1. Nginx installieren
   - Befehl: `sudo apt install -y nginx`
   - Grund: Installiert den Webserver, der als Reverse Proxy dient.
2. Firewall oeffnen
   - Befehl: `sudo ufw allow 'Nginx Full'`
   - Grund: Erlaubt HTTP- und HTTPS-Traffic durch die Firewall.
3. Nginx-Serverblock anlegen
   - Befehl: `sudo nano /etc/nginx/sites-available/htw-ai-bot`
   - Grund: Erstellt die Proxy-Konfiguration fuer die neue Domain.
4. Proxy-Konfiguration einfuegen
   - Inhalt:
     ```nginx
     server {
         listen 80;
         server_name neue-domain.tld;

         location / {
             proxy_pass http://127.0.0.1:3000;
             proxy_set_header Host $host;
             proxy_set_header X-Real-IP $remote_addr;
             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
             proxy_set_header X-Forwarded-Proto $scheme;
         }
     }
     ```
   - Grund: Leitet eingehende Anfragen an den Node.js-Port weiter (Domain anpassen).
5. Site aktivieren
   - Befehl: `sudo ln -s /etc/nginx/sites-available/htw-ai-bot /etc/nginx/sites-enabled/`
   - Grund: Schaltet die neue Konfiguration scharf.
6. Nginx-Konfiguration testen
   - Befehl: `sudo nginx -t`
   - Grund: Prueft die Konfiguration auf Syntaxfehler.
7. Nginx neu laden
   - Befehl: `sudo systemctl reload nginx`
   - Grund: Uebernimmt die neue Konfiguration ohne Downtime.
8. Lets-Encrypt-Zertifikat holen
   - Befehl: `sudo certbot --nginx -d neue-domain.tld`
   - Grund: Richtet ein TLS-Zertifikat fuer die Domain ein.
9. Renewal testen
   - Befehl: `sudo certbot renew --dry-run`
   - Grund: Stellt sicher, dass die automatische Zertifikatserneuerung funktioniert.

## 8. Nacharbeiten und Monitoring
1. HTTPS testen
   - Befehl: `curl -I https://neue-domain.tld`
   - Grund: Verifiziert, dass die Domain ueber HTTPS erreichbar ist.
2. Logdateien der App pruefen
   - Befehl: `sudo -u htw-ai-bot tail -n 100 /opt/htw-ai-bot/app/logs/audit.log`
   - Grund: Kontrolliert, dass Audit-Logs geschrieben werden.
3. Admin-Zugang haerten
   - Befehl: `sudo -u htw-ai-bot node -e "const auth=require('./controllers/authController.cjs'); (async () => { await auth.updateUserPassword('admin','<NEUES_PASSWORT>'); console.log('Passwort geaendert'); })();"`
   - Grund: Ersetzt das Standardpasswort vor dem Go-Live.
4. Backup der SQLite-Datenbank planen
   - Befehl: `sudo cp /opt/htw-ai-bot/app/hochschuhl-abc.db /var/backups/hochschuhl-abc-$(date +%F).db`
   - Grund: Erstellt Sicherungen der Datenbank fuer Disaster-Recovery.
