# Konzept: AI Bot Dashboard

**Grundprinzip:** Das Dashboard ist in eine **Übersichtsseite** für den schnellen täglichen Einblick und mehrere **Detailseiten** für die Tiefenanalyse unterteilt. Globale Filter (Zeitraum, etc.) sind immer verfügbar.

---

## 1. Die Übersichtsseite (Dashboard-Startseite)

**Ziel:** In 30 Sekunden den Zustand des Bots erfassen und die dringendsten Aufgaben identifizieren.

#### A) KPI-Karten (Key Performance Indicators)
Eine Reihe von "Karten", die die wichtigsten Metriken prominent anzeigen.
- **Gesamt-Sessions:** Anzahl der Konversationen.
- **Erfolgsquote:** Prozentualer Anteil der Fragen, die eine direkte Antwort erhielten.
- **Feedback-Score:** Durchschnittliche Zufriedenheit der Nutzer in Prozent.
- **Offene neue Fragen:** Anzahl einzigartiger, unbeantworteter Fragen im gewählten Zeitraum.

#### B) Handlungsorientierte Top-Listen
Direkt umsetzbare Einblicke für die Redaktion.
- **Top 5 unbeantwortete Fragen:** Eine Liste der am häufigsten gestellten Fragen, die der Bot nicht beantworten konnte. *Dies ist die wichtigste Quelle für neue Artikel.*
- **Einblick in Feedback** Was wurde von den Nutzern abgeschickt (letzten 3 Beschwerden)*

#### C) Graphen für den schnellen Überblick
- **Liniendiagramm: Sessions der letzten 7 Tage:** Visualisiert die Nutzungsaktivität. (x: Tage; y: Anzahl Sessions)
- **Live-Aktivitäts-Feed (Optional):** Ein kleiner Bereich, der die letzten 3-5 Interaktionen anzeigt -> Datenschutz kritsch, vielleicht erstmal als optional

---

## 2. Detailseite: Nutzungsanalyse

**Ziel:** Verstehen, *wie* und *wofür* der Bot genutzt wird.

- **Kennzahlen & Graphen:**
  - Graphen für Gesamt-Sessions, eindeutige Nutzer und Nachrichten pro Session im Zeitverlauf.
  - **Wortwolke oder Balkendiagramm der Top-Themen/Keywords:** Visualisiert, worüber die Nutzer am meisten sprechen.
  - **Tabelle: Meistgenutzte Artikel:** Zeigt die populärsten und wichtigsten Inhalte.

---

## 3. Detailseite: Qualitäts- & Performance-Analyse

**Ziel:** Die technische und inhaltliche Qualität des Bots sicherstellen.

#### A) Systemzustand
- **Grafik: Durchschnittliche Antwortzeit (API):** Zeigt Engpässe und Latenzen.
- **KPI-Karte: Server-Fehlerrate (5xx-Fehler):** Wichtiger Indikator für technische Probleme.
- **Tabelle: Häufigste Fehlermeldungen:** Detaillierte Einsicht für Entwickler zur Fehlerbehebung.

#### B) Inhaltsqualität
- **Grafik: Feedback-Verteilung (Positiv/Negativ) im Zeitverlauf.**
- **Tabelle: Vollständiges Feedback-Protokoll:** Jedes einzelne Feedback (Daumen hoch/runter) mit der gestellten Frage und dem gelieferten Artikel, sortier- und filterbar.

---

## 4. Detailseite: Content- & Admin-Management

**Ziel:** Den Content-Pool und die redaktionelle Arbeit verwalten.

#### A) Content-Status
- **KPIs:** Anzahl aktiver vs. archivierter Beiträge.
- **Tabelle:** Liste der zuletzt erstellten oder bearbeiteten Beiträge (Admin-Aktivitätsprotokoll).

#### B) Aufgaben-Management
- **Tabelle: Vollständige Liste aller unbeantworteten Fragen:** Filterbar nach Häufigkeit und Datum, mit einem Button, um direkt einen neuen Artikel für eine ausgewählte Frage zu erstellen.

---

## 5. Globale & Praktische Funktionen

Diese Funktionen sind auf allen Seiten verfügbar und entscheidend für die Benutzerfreundlichkeit.

- **Umfassende Filter:** Nach Zeitraum, Benutzergruppe (falls zutreffend), Themen/Tags.
- **Daten-Export:** Jede Tabelle und jeder Graph sollte als CSV/Excel oder Bild herunterladbar sein.
- **Benachrichtigungen (Alerts):** E-Mail- oder System-Alerts, wenn definierte Schwellenwerte überschritten werden (z.B. "Fehlerrate > 5%", "10 neue negative Bewertungen in einer Stunde").
