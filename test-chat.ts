import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = "You are a helpful tutor.";

    try {
        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: "Hello, what's 1+1?" }] },
                { role: 'model', parts: [{ text: "1+1 is 2." }] }
            ],
            systemInstruction: {
                role: "system",
                parts: [{ text: systemPrompt }]
            },
            generationConfig: { temperature: 0.7 }
        });

        console.log("Sending multi-turn message...");
        const result = await chat.sendMessage("What about 2+2?");
        console.log("SUCCESS:", result.response.text());
    } catch (e: any) {
        console.error("SDK ERROR:", e.message);
    }
}

test();
