# Dashboard Implementation

## 📊 Übersicht
Das Dashboard bietet umfassende Analytics für das HTC ABC AI Bot System. Es zeigt wichtige Metriken, Nutzungsstatistiken und Performance-Indikatoren.

## 🚀 Zugriff

### **Production:**
- **URL**: `https://dev.olomek.com/dash`
- **Authentifizierung**: Admin-Login erforderlich

### **Development:**
- **URL**: `http://localhost:3000/dash`
- **Admin-Bypass**: `node server.cjs -admin` (überspringt Login)

## ✨ Features

### KPI Dashboard
- **Gesamt Sessions**: Alle Benutzer-Sessions
- **Sessions Heute**: Aktuelle Tagesstatistik
- **Erfolgsrate**: Prozentsatz erfolgreicher AI-Antworten
- **Offene Fragen**: Anzahl unbeantworteter Benutzeranfragen

### Analytics Bereiche

#### **📊 Hauptbereiche:**
1. **Unbeantwortete Fragen**: Top 5 häufigste Fragen ohne Antwort (intelligente Gruppierung)
2. **Häufigste Fragen**: Top 5 meistgestellte Fragen (alle) mit Status-Anzeige
3. **Sessions-Chart**: 7-Tage Balkendiagramm der Nutzeraktivität
4. **Meistaufgerufene Artikel**: Häufig referenzierte Wissensbasis-Artikel
5. **Content-Statistiken**: Aktive vs. archivierte Artikel
6. **Feedback-Analyse**: Positive/Negative Rückmeldungen
7. **Recent Feedback**: Neuestes Nutzerfeedback

#### **🔍 Besondere Features:**
- **Intelligente Fragen-Gruppierung**: "Wo ist die Mensa?" und "where is the canteen?" werden zusammengefasst
- **Mehrsprachige Erkennung**: Deutsche und englische Fragen werden automatisch gruppiert
- **Echtzeit-Updates**: Auto-Refresh alle 30 Sekunden
- **Session-Fallback**: Nutzt bestehende Daten (Questions/Feedback) wenn User-Sessions leer sind

## 🗄️ Datenbank Struktur

### Neue Tabellen
```sql
-- Benutzer-Sessions mit Metriken
user_sessions (
  id, session_id, ip_address, user_agent,
  started_at, last_activity, questions_count,
  successful_answers, ended_at
)

-- Chat-Interaktionen mit Performance-Daten
chat_interactions (
  id, session_id, question, answer,
  was_successful, response_time_ms, tokens_used,
  timestamp, error_message
)

-- Artikel-Aufrufe mit Kontext
article_views (
  id, article_id, session_id, viewed_at,
  question_context
)
```

## 🔧 API Endpunkte

### Dashboard APIs
- `GET /api/dashboard/kpis` - Haupt-KPIs
- `GET /api/dashboard/unanswered-questions` - Unbeantwortete Fragen
- `GET /api/dashboard/recent-feedback` - Aktuelles Feedback
- `GET /api/dashboard/sessions` - Session-Verlauf (7 Tage)
- `GET /api/dashboard/most-viewed-articles` - Meistgesuchte Artikel
- `GET /api/dashboard/feedback-stats` - Feedback-Statistiken
- `GET /api/dashboard/content-stats` - Content-Metriken

## 🛠️ Installation & Setup

### 1. Database Migration
```bash
node scripts/create_dashboard_tables.js
```

### 2. Analytics Aktivierung
Das Analytics-System ist automatisch integriert und erfasst:
- Alle Chat-Interaktionen in `/api/chat`
- Session-Tracking via Cookies
- Artikel-Views basierend auf AI-Antworten
- Performance-Metriken (Response-Zeit, Token-Usage)

### 3. Server-Start
```bash
npm start
# Dashboard verfügbar unter: http://localhost:3000/dash
```

## 📈 Datenerfassung

### **✅ Vollständig Implementiert:**
- **Fragen-Tracking**: Alle unbeantworteten Fragen in `questions` Tabelle
- **Feedback-Tracking**: Nutzerfeedback in `feedback` Tabelle  
- **Content-Management**: Artikel-Verwaltung in `hochschuhl_abc` Tabelle
- **Erfolgsrate**: Basiert auf beantworteten vs. unbeantworteten Fragen
- **Intelligente Fragen-Gruppierung**: Multilingual mit Normalisierung
- **Sessions-Fallback-System**: Nutzt bestehende Daten wenn UserSessions leer
- **Artikel-Tracking-Infrastructure**: Vollständig bereit für Produktionseinsatz

### **⏳ Benötigt Produktionsdaten:**
- **Session Management**: UserSessions werden automatisch bei Chat-Nutzung erstellt
- **Chat Tracking**: Performance-Metriken werden bei jeder AI-Interaktion erfasst
- **Article Views**: Wartet auf AI-Antworten die Artikel-IDs referenzieren

### **📊 Sessions-Fallback System:**
Das Dashboard nutzt ein intelligentes dreistufiges Fallback-System für robuste Datenanzeige:
1. **Primär**: `user_sessions` Tabelle (automatisch bei Chat-Nutzung befüllt)
2. **Fallback 1**: `feedback` Tabelle → Unique conversation_ids als Session-Proxy
3. **Fallback 2**: `questions` Tabelle → Frage-Aktivitäten als minimaler Session-Indikator

Dies gewährleistet, dass das Dashboard auch bei neuen Installationen aussagekräftige Daten anzeigt.

### **🔍 Artikel-Views System:**
```javascript
// So funktioniert Article-Tracking:
1. User stellt Frage → AI antwortet mit Artikel-Referenz
2. extractArticleIds() erkennt Artikel-IDs in der Antwort  
3. trackArticleView() speichert View in article_views Tabelle
4. Dashboard zeigt meistaufgerufene Artikel basierend auf Tracking-Daten
```

**Status:** Das Artikel-Tracking-System ist vollständig implementiert und funktionsbereit. Die `article_views` Tabelle ist momentan leer, da das System AI-Antworten benötigt, die explizit auf Artikel aus der `hochschuhl_abc` Wissensbasis verweisen. Sobald die AI beginnt, spezifische Artikel-IDs in ihren Antworten zu erwähnen, werden diese automatisch erfasst und im Dashboard angezeigt.

### Datenschutz
- IP-Adressen werden anonymisiert gespeichert
- Sessions werden nach 30 Minuten Inaktivität automatisch beendet
- Keine persönlichen Daten werden dauerhaft gespeichert

## 🎯 Success Metrics

### Erfolgreiche Antworten
Eine Antwort gilt als erfolgreich, wenn sie **nicht** den Text `<+>` enthält (Standard für "kann nicht beantwortet werden").

### Artikel-Tracking
Das System erkennt automatisch Artikel-Referenzen in AI-Antworten und trackt, welche Wissensbasis-Artikel am häufigsten verwendet werden.

## 📊 Dashboard Charts

### CSS-Basierte Charts
- **Sessions Chart**: Interaktive Balken-Diagramme mit Hover-Effekten für 7-Tage-Verlauf
- **Responsive Bars**: Automatische Skalierung basierend auf Maximalwerten
- **Visual Indicators**: Besondere Kennzeichnung für heutige Aktivitäten
- **Fallback-Unterstützung**: Charts funktionieren auch mit leeren Daten

### Design & UX
- **Mobile-optimierte Darstellung**: Vollständig responsive auf allen Geräten
- **Professional Theme**: Inter-Font mit HTW-Branding
- **Font Awesome Icons**: Konsistente Icon-Sprache
- **TailwindCSS**: Moderne Utility-First CSS-Framework
- **Smooth Transitions**: Animierte Übergänge und Hover-Effekte

## 🔍 Debugging & Testing

### Test Script
```bash
node test_dashboard.js
# Testet alle Dashboard-APIs ohne Server-Start
```

### Log Monitoring
- Analytics-Fehler werden in der Konsole ausgegeben
- Session-Tracking läuft transparent im Hintergrund
- API-Endpunkte haben eingebaute Fehlerbehandlung

## 🚨 Troubleshooting

### Häufige Probleme
1. **Leere Dashboard-Daten**: Normal bei Neuinstallation - Daten sammeln sich automatisch
2. **API-Fehler**: Überprüfen ob Migration korrekt ausgeführt wurde
3. **Session-Probleme**: Cookies müssen aktiviert sein

### Debug Commands
```bash
# Database schema prüfen
node -e "const {sequelize} = require('./controllers/db.cjs'); sequelize.getQueryInterface().showAllTables().then(console.log)"

# Analytics testen  
node test_dashboard.js
```

## 🎯 Dashboard Status

### **✅ Vollständig Implementiert (Januar 2025)**
- **Umfassende KPI-Dashboards**: Sessions, Erfolgsrate, offene Fragen
- **Intelligente Fragen-Gruppierung**: Multilingual mit Normalisierung  
- **Robustes Fallback-System**: Funktioniert auch bei leeren Analytics-Tabellen
- **Responsive Design**: Professional UI mit HTW-Branding
- **Artikel-Tracking-Ready**: Infrastructure bereit für Produktionsdaten
- **Auto-Refresh**: 30-Sekunden Updates mit Session-Management
- **Minimaler Console Output**: Produktionstaugliche Logging-Konfiguration

### **🚀 Bereit für Produktionseinsatz**
Das Dashboard ist vollständig funktionsbereit und sammelt automatisch alle verfügbaren Daten aus der bestehenden Infrastruktur. Neue Analytics-Features werden automatisch aktiviert, sobald Produktionsdaten verfügbar sind.

### **💡 Mögliche Erweiterungen**
- Real-time Updates via WebSocket
- Export-Funktionen für Analytics-Daten  
- Erweiterte Benutzer-Segmentierung
- Performance-Alerts bei kritischen Metriken

---

**🎉 Dashboard ist vollständig einsatzbereit für HTW Dresden HTC ABC AI Bot!**