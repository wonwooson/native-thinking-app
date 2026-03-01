import express from 'express';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In dev (server/index.ts), __dirname is /server. In prod (dist-server/index.js), __dirname is /dist-server.
// We go up one level from __dirname to reach the project root, then into /dist.
const rootDir = path.join(__dirname, '..');
const distPath = path.join(rootDir, 'dist');

const execAsync = promisify(exec);

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/parse-text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text input is required' });

    const systemPrompt = `
You are an English parsing assistant. The user will provide raw text (e.g., YouTube subtitles) that may lack punctuation or be broken across lines unnaturally. 
Your task is to cleanly reconstruct the text into an array of proper, logical English sentences (with correct capitalization and punctuation).
Return ONLY a valid JSON array of strings. Do not invent sentences; just fix the punctuation and segment the text. 
Example Output: ["I went to the store.", "It was closed."]
`;

    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "No API KEY" });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\nText:\n${text}`,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    try {
      const sentences = JSON.parse(response.text?.trim() || "[]");
      res.json({ sentences });
    } catch {
      res.status(500).json({ error: "Failed to parse sentences" });
    }
  } catch (error: any) {
    console.error('Error in /api/parse-text:', error);
    if (error.status === 429 || error.message?.includes('429')) {
      return res.status(429).json({ error: '현재 Gemini API 요금제(무료) 요청 한도를 초과했습니다. 약 1분 정도 기다렸다가 다시 시도해 주세요. (429 Rate Limit)' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

function extractVideoId(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
  return (match && match[1]) ? match[1] : null;
}

app.post('/api/fetch-transcript', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'YouTube URL is required' });

    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

    try {
      // Use python youtube-transcript-api to bypass JS blocks
      const { stdout } = await execAsync(`python -m youtube_transcript_api ${videoId} --format json`);
      let list = JSON.parse(stdout);

      // The CLI returns an array of arrays when single ID is passed in some versions, or just an array.
      if (Array.isArray(list) && Array.isArray(list[0])) {
        list = list[0];
      }

      if (!list || list.length === 0) {
        return res.status(404).json({ error: '이 영상에는 추출할 수 있는 영어 자막이 없습니다. 다른 영상을 시도해 주세요.' });
      }

      const text = list.map((t: any) => t.text.replace(/\n/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'")).join(' ');
      res.json({ text });
    } catch (cmdErr: any) {
      console.error('Python Extractor failed:', cmdErr?.stderr || cmdErr.message);
      return res.status(404).json({ error: '이 영상에는 추출할 수 있는 영어 자막이 없습니다. 다른 영상을 시도해 주세요.' });
    }
  } catch (error: any) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: '자막을 가져오는데 실패했습니다. 비공개 영상이거나 자막이 비활성화되어 있을 수 있습니다.' });
  }
});

app.post('/api/format-paragraphs', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for formatting' });
    }

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\nRaw text:\n${text}`,
      config: {
        responseMimeType: 'application/json'
      }
    });

    let responseText = response.text || "";
    console.log("=== GEMINI RAW OUTPUT ===", responseText);
    fs.writeFileSync('debug.txt', responseText);

    let formattedText = text;
    try {
      const paragraphsArray = JSON.parse(responseText);
      if (Array.isArray(paragraphsArray) && paragraphsArray.length > 0) {
        formattedText = paragraphsArray.join('\n\n');
        console.log("Successfully joined", paragraphsArray.length, "paragraphs.");
      }
    } catch (parseErr) {
      console.error("Failed to parse paragraph JSON", parseErr);
    }

    res.json({ formattedText, debugRaw: responseText });
  } catch (error: any) {
    console.error('Error formatting paragraphs:', error);
    // Graceful fallback
    res.json({ formattedText: req.body.text });
  }
});

app.post('/api/generate-speaking-guide', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const systemPrompt = `
You are an expert American English pronunciation coach. 
The user will provide an English text. Your job is to format this text for speaking practice (shadowing).

Apply these TWO rules to the text:
1. Insert a forward slash ( / ) at natural pause boundaries (e.g., after commas, between clauses, before conjunctions). Do NOT put a slash after every single word. Group words into natural thought groups.
2. Wrap words that carry primary sentence stress or strong intonation with double asterisks (**word**) to make them bold. Typically nouns, main verbs, adjectives, and adverbs. 
3. CRITICAL: You MUST preserve the original paragraph breaks (double newlines \`\n\n\`). Do NOT collapse the text into a single paragraph.

Return ONLY the formatted string. Do not include any extra context, introductions, or JSON wrappers. You MUST include the \`**\` literal characters in the output.

Example Input:
As a little girl I loved playing sports and I loved learning.

Example Output:
As a **little** **girl** / I **loved** **playing** **sports** / and I **loved** **learning**.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\nInput text:\n${text}`,
      config: {
        responseMimeType: 'text/plain'
      }
    });

    const outputText = response.text || text;
    console.log("=== SPEAKING GUIDE RAW OUTPUT ===");
    console.log(outputText.substring(0, 200) + '...');

    res.json({ guideText: outputText });
  } catch (error: any) {
    console.error('Error generating speaking guide:', error);
    // Graceful fallback: return the original text if AI fails
    res.json({ guideText: req.body.text });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { sentences, isLink } = req.body;

    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      return res.status(400).json({ error: 'Array of sentences is required' });
    }

    const batchSentences = sentences.join('\n');

    const systemPrompt = `
You are an expert English teacher for Korean learners. You must analyze the following English content and return a JSON object with EXACTLY this structure (do not wrap in markdown tags like \`\`\`json):

{
  "word_order": [
    {
      "original": "English sentence",
      "blocks": [
        { "text": "English chunk 1", "role": "Korean role (e.g. 주어)" },
        { "text": "English chunk 2", "role": "Korean role (e.g. 동사/행위)" }
      ],
      "thinking_flow_ko": "Korean explanation of the native thinking flow",
      "kr_typical_mistake": "Example of a typical Korean mistake regarding this word order",
      "quiz": {
        "question": "A multiple-choice question in Korean about the word order or grammar of this specific sentence",
        "options": ["Option 1", "Option 2", "Option 3"],
        "answer": "The exact string of the correct option",
        "feedbackKo": "Friendly Korean explanation of why this answer is correct"
      }
    }
  ],
  "phrasal_verbs": [
    {
      "expression": "Phrasal verb used",
      "base_meaning_ko": "Korean base meaning",
      "context_meaning_ko": "Korean meaning in this specific context",
      "similar_expressions": [
        { "expression": "Similar expression", "difference_ko": "Nuance difference in Korean" }
      ],
      "common_mistake_ko": "Common Mistake in Korean",
      "priority": 1
    }
  ],
  "tricky_prepositions": [
    {
      "expression": "Preposition (e.g., to, for, at)",
      "correct_usage_example": "Correct English sentence",
      "wrong_usage_example": "Wrong English sentence (common mistake)",
      "native_reaction_ko": "How natives feel about the wrong usage",
      "story_ko": "A brief spatial or conceptual story of what this preposition means"
    }
  ]
}

Analyze the EXACT following text block:
"""
${batchSentences}
"""

CRITICAL INSTRUCTIONS:
1. You MUST extract EVERY SINGLE sentence provided in the text block above into the \`word_order\` array.
2. DO NOT invent, hallucinate, or generate placeholder sentences (like "The quick brown fox" or "She is learning English"). You MUST ONLY use the exact sentences provided above.
3. Since ${sentences.length} sentences are provided, there MUST be exactly ${sentences.length} items in the \`word_order\` array.
4. For EACH item in the \`word_order\` array, you MUST generate a unique \`quiz\` object tailored specifically to that sentence's grammar, vocabulary, or word order.
5. For \`phrasal_verbs\` and \`tricky_prepositions\`, extract the 1-3 most important items found across ALL the sentences combined.
6. Ensure the output is strictly valid JSON matching the exact schema provided.
`;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing in .env" });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    if (!response.text) throw new Error("No response text from Gemini");

    try {
      const parsedData = JSON.parse(response.text.trim());
      // hasMore logic is now handled by the frontend
      res.json(parsedData);
    } catch (e) {
      console.error("Failed to parse AI JSON:", response.text);
      res.status(500).json({ error: "AI returned invalid JSON" });
    }

  } catch (error: any) {
    console.error('Error in /api/analyze:', error);
    if (error.status === 429 || error.message?.includes('429')) {
      return res.status(429).json({ error: '현재 Gemini API 요금제(무료) 요청 한도를 초과했습니다. 약 1분 정도 기다렸다가 다시 시도해 주세요. (429 Rate Limit)' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve frontend static files from the Vite build output directory
app.use(express.static(distPath));

// Catch-all route to serve index.html for React Router compatibility
// Express 5.x requires regex instead of wildcard strings
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
