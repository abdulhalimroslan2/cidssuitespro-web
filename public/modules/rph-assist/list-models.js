require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    const apiKey = process.argv[2] || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Please provide an API key as an argument or set GEMINI_API_KEY");
        process.exit(1);
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        console.log("Available models:");
        data.models.forEach(m => {
            if (m.supportedGenerationMethods.includes("generateContent")) {
                console.log(m.name);
            }
        });
    } catch (e) {
        console.error(e);
    }
}
listModels();
