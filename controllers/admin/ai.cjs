const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { HochschuhlABC } = require('../db.cjs');

module.exports = (authMiddleware) => {
  const router = express.Router();
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set. The AI feature will not work.");
    // Return a router that does nothing but return an error
    router.post('/analyze-text', authMiddleware, (req, res) => {
      res.status(500).json({ error: 'AI feature is not configured on the server.' });
    });
    return router;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  router.post('/analyze-text', authMiddleware, async (req, res) => {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Get all existing articles from the database for context
      const allArticles = await HochschuhlABC.findAll({
        attributes: ['headline', 'text'],
        where: { active: true }
      });
      const context = allArticles.map(a => `Überschrift: ${a.headline}\nText: ${a.text}`).join('\n\n---\n\n');

      const prompt = `
        Du bist ein Lektor für die Wissensdatenbank einer Hochschule.
        Analysiere den folgenden Text und gib deine Antwort AUSSCHLIESSLICH als valides JSON-Objekt zurück.

        **JSON-Schema:**
        {
          "correctedText": "string",
          "corrections": [{ "original": "string", "corrected": "string", "reason": "string" }],
          "suggestions": [{ "suggestion": "string", "reason": "string" }],
          "contradictions": [{ "contradiction": "string", "reason": "string" }]
        }

        **Analyseprozess:**
        1.  **Rechtschreibung & Grammatik:**
            - Korrigiere NUR objektive Rechtschreib- und Grammatikfehler direkt im Text und erstelle daraus den Wert für "correctedText".
            - Führe KEINE stilistischen oder inhaltlichen Änderungen im "correctedText" durch.
            - Fülle das "corrections"-Array für JEDE einzelne Korrektur mit dem Original, der Korrektur und einer kurzen Begründung.
        2.  **Stil & Tonalität:**
            - Mache Vorschläge zur Verbesserung von Stil und Tonalität. Diese dürfen NICHT in den "correctedText" einfließen.
            - Fülle das "suggestions"-Array mit deinen Vorschlägen und Begründungen.
        3.  **Widersprüche & Dopplungen:**
            - Vergleiche den Text mit dem "Kontext aus bestehenden Artikeln".
            - Fülle das "contradictions"-Array, wenn du inhaltliche Widersprüche oder signifikante Dopplungen findest.

        **WICHTIG:** Gib nur das JSON-Objekt zurück, ohne umschließende Zeichen wie \`\`\`json.

        **Zu analysierender Text:**
        ---
        ${text}
        ---

        **Kontext aus bestehenden Artikeln:**
        ---
        ${context}
        ---
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      // Clean the response to ensure it's valid JSON
      const cleanedText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const analysis = JSON.parse(cleanedText);

      res.json(analysis);

    } catch (error) {
      console.error('Error analyzing text with AI:', error);
      res.status(500).json({ error: 'Failed to analyze text' });
    }
  });

  router.post('/improve-text', authMiddleware, async (req, res) => {
    const { text, suggestion } = req.body;

    if (!text || !suggestion) {
      return res.status(400).json({ error: 'Text and suggestion are required' });
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `
        Du bist ein Lektor. Wende die folgende Anweisung zur Verbesserung auf den gegebenen Text an.
        Gib NUR den vollständig verbesserten Text im Markdown-Format zurück, ohne weitere Erklärungen.

        Anweisung: "${suggestion}"

        Text:
        ---
        ${text}
        ---
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const improvedText = response.text();

      res.json({ improvedText });

    } catch (error) {
      console.error('Error improving text with AI:', error);
      res.status(500).json({ error: 'Failed to improve text' });
    }
  });

  return router;
};