const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs').promises;
const path = require('path');

const apiKey = process.env.API_KEY || 'Nicht gefunden';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function readTextFile(filePath) {
  try {
    const absolutePath = path.resolve(__dirname, filePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    return content;
  } catch (error) {
    console.error(`Fehler beim Lesen der Datei ${filePath}:`, error);
    throw error;
  }
}

async function logUnansweredQuestion(question) {
  try {
    const logFile = path.resolve(__dirname, 'offene_fragen.txt');
    const timestamp = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
    const logEntry = `[${timestamp}] Frage: ${question}\n`;
    await fs.appendFile(logFile, logEntry, 'utf8');
  } catch (error) {
    console.error("Fehler beim Protokollieren der offenen Frage:", error);
  }
}

async function generateResponse(req, res) {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt ist erforderlich" });
    }

    // Lese die Inhalte der Textdateien
    const hochschulText = await readTextFile('Hochschul_ABC_2025_text.txt');
    const faqText = await readTextFile('faq.txt');

    // Erstelle den vollständigen Prompt
    const fullPrompt = `
      Du bist ein Agent, der ausschließlich Fragen basierend auf den folgenden Informationen beantwortet:
      
      **Inhalt von Hochschul_ABC_2025_text.txt**:
      ${hochschulText}
      
      **Inhalt von faq.txt**:
      ${faqText}
      
      Benutzerfrage: ${prompt}
      
      Anweisungen:
      - Beantworte die Frage nur, wenn sie direkt auf den Inhalt der beiden Dateien bezogen ist.
      - Wenn die Frage nicht beantwortet werden kann, antworte mit: "Diese Frage kann basierend auf den bereitgestellten Informationen nicht beantwortet werden."
      - Gib keine Informationen oder Vermutungen außerhalb der bereitgestellten Dateien.
      - Halte die Antwort präzise und klar.
    `;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    // Überprüfe, ob die Frage nicht beantwortet werden konnte
    if (text.includes("Diese Frage kann basierend auf den bereitgestellten Informationen nicht beantwortet werden")) {
      await logUnansweredQuestion(prompt);
    }

    res.json({ response: text });
  } catch (error) {
    console.error("Fehler beim Generieren der Antwort:", error);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
}

module.exports = { generateResponse };
