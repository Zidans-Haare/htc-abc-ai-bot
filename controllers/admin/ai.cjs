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
        Analysiere den folgenden Text eines neuen oder überarbeiteten Artikels.

        Prüfe auf die folgenden drei Punkte:
        1.  **Widersprüche und Dopplungen:** Vergleiche den Text mit dem folgenden Kontext aus bestehenden Artikeln. Gibt es inhaltliche Widersprüche oder signifikante inhaltliche Überschneidungen, die zu Dopplungen führen?
        2.  **Rechtschreibung und Grammatik:** Korrigiere alle Rechtschreib- und Grammatikfehler.
        3.  **Stil und Tonalität:** Stelle sicher, dass der Text in einem klaren, informativen und für Studierende geeigneten Ton verfasst ist.

        Gib deine Vorschläge in einer klaren, strukturierten Form zurück. Liste die gefundenen Probleme und deine Verbesserungsvorschläge auf.

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
      const analysis = response.text();

      res.json({ analysis });

    } catch (error) {
      console.error('Error analyzing text with AI:', error);
      res.status(500).json({ error: 'Failed to analyze text' });
    }
  });

  return router;
};