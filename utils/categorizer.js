const { GoogleGenerativeAI } = require("@google/generative-ai");

// This should be the same API key used in the main controller
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  // This check is a safeguard. In production, the main app would already have exited.
  throw new Error("GEMINI_API_KEY environment variable not set.");
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const CATEGORIES = [
    "Immatrikulation & Bewerbung",
    "Prüfungen & Noten",
    "Bibliothek & Ressourcen",
    "Campus-Leben & Mensa",
    "Organisation & Verwaltung",
    "Technischer Support & IT",
    "Internationales & Auslandssemester",
    "Feedback zum Bot",
    "Sonstiges & Unklares"
];

/**
 * Analyzes a conversation history and assigns it to a predefined category.
 * @param {Array<object>} messages - The conversation history, array of {role, content}.
 * @returns {Promise<{category: string, confidence: number}|null>} - The category and confidence score, or null on error.
 */
async function categorizeConversation(messages) {
    console.log(`[Categorizer] Starting categorization for conversation...`);

    if (!messages || messages.length === 0) {
        console.log("[Categorizer] No messages provided.");
        return null;
    }

    // Format the conversation for the prompt
    const conversationText = messages
        .map(msg => `${msg.role === 'user' ? 'Nutzer' : 'Assistent'}: ${msg.content}`)
        .join('\n');

    const prompt = `
        Analysiere die folgende Konversation und ordne sie einer der folgenden Kategorien zu.
        Antworte ausschließlich mit einem JSON-Objekt, das die Schlüssel "category" und "confidence" enthält.
        Die "category" muss exakt einer der vorgegebenen Kategorien entsprechen.
        Die "confidence" soll ein numerischer Wert zwischen 0.0 und 1.0 sein, der deine Sicherheit bei der Zuordnung angibt.

        Vorgegebene Kategorien:
        - ${CATEGORIES.join("\n-")}

        Konversation:
        ---
        ${conversationText}
        ---
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        // Clean the response to ensure it's valid JSON
        const jsonString = text.replace(/^```json\s*|```\s*$/g, '');
        const data = JSON.parse(jsonString);

        if (data && data.category && typeof data.confidence === 'number') {
            if (CATEGORIES.includes(data.category)) {
                console.log(`[Categorizer] Successfully categorized conversation as '${data.category}' with confidence ${data.confidence}.`);
                return data;
            } else {
                console.warn(`[Categorizer] AI returned an invalid category: '${data.category}'. Defaulting to 'Sonstiges & Unklares'.`);
                return { category: "Sonstiges & Unklares", confidence: data.confidence };
            }
        }
        
        console.error("[Categorizer] AI response was not in the expected JSON format:", text);
        return null;

    } catch (error) {
        console.error("[Categorizer] Error during API call:", error.message);
        return null;
    }
}

module.exports = { categorizeConversation };
