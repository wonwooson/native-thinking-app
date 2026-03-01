const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
    const text = "Transcriber: Joseph Geni Reviewer: Morton Bast When I was 27 years old, I left a very demanding job in management consulting for a job that was even more demanding: teaching. I went to teach seventh graders math in the New York City public schools. And like any teacher, I made quizzes and tests. I gave out homework assignments. When the work came back, I calculated grades. What struck me was that IQ was not the only difference between my best and my worst students. Some of my strongest performers did not have stratospheric IQ scores. Some of my smartest kids weren't doing so well. And that got me thinking. The kinds of things you need to learn in seventh grade math, sure, they're hard: ratios, decimals, the area of a parallelogram. But these concepts are not impossible, and I was firmly convinced that every one of my students could learn the material if they worked hard and long enough. After several more years of teaching, I came to the conclusion that what we need in education is a much better understanding of students and learning from a motivational perspective, from a psychological perspective.";

    const systemPrompt = `
You are an expert editor who improves the readability of English transcripts.
Your task is to take the provided raw text and split it into logical paragraphs (about 3 to 5 sentences each).

CRITICAL RULES:
1. Return ONLY a valid JSON array of strings, where each string is a paragraph.
2. DO NOT change, add, or remove ANY English words or punctuation from the original text. You are only splitting it.
3. DO NOT include any markdown formatting, introductory remarks, or explanations.

EXAMPLE FORMAT:
[
  "This is sentence one. This is sentence two. This is sentence three.",
  "This is sentence four. This is sentence five. This is sentence six."
]
`;

    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        // generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent([
        systemPrompt,
        { text: "Raw text:\\n" + text }
    ]);

    const responseText = result.response.text();
    console.log("=== RAW API OUTPUT ===");
    console.log(responseText);
}

test().catch(console.error);
