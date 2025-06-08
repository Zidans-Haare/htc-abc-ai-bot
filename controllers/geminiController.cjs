const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.API_KEY || 'Not found';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
// console.log(`API_KEY: ${apiKey}`);

async function generateResponse(req, res) {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ response: text });
  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { generateResponse };
