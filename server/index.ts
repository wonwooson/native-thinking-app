import express from 'express';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

// Only load .env file in local development. In production, Render injects env vars directly.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nText:\n${text}` }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    try {
      const sentences = JSON.parse(response.response.text().trim() || "[]");
      res.json({ sentences });
    } catch {
      res.status(500).json({ error: "Failed to parse sentences" });
    }
  } catch (error: any) {
    console.error('Error in /api/parse-text:', error);
    if (error.status === 429 || error.message?.includes('429')) {
      if (error.message?.includes('monthly spending cap')) {
        return res.status(429).json({ error: 'Gemini API 프로젝트의 월간 사용량 한도(Spending Cap)를 초과했습니다. Google AI Studio에서 결제/한도 설정을 확인하거나 새로운 API 키를 발급받으세요.' });
      }
      return res.status(429).json({ error: '현재 Gemini API 요금제(무료) 요청 한도를 초과했습니다. 약 1분 정도 기다렸다가 다시 시도해 주세요. (429 Rate Limit)' });
    }
    res.status(500).json({ error: `Internal server error: ${error.message || 'Unknown'}` });
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

    const MAX_RETRIES = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        console.log(`Transcript extraction attempt ${attempt} for ${videoId}...`);

        // 1. Try RapidAPI First (Fastest and most reliable on Cloud Run)
        const rapidApiKey = process.env.RAPIDAPI_KEY;
        if (rapidApiKey) {
          try {
            console.log(`[Attempt ${attempt}] Trying RapidAPI...`);
            const axios = (await import('axios')).default;
            const { data } = await axios.get('https://youtube-transcript3.p.rapidapi.com/api/transcript', {
              params: { videoId: videoId, lang: 'en' },
              headers: {
                'X-RapidAPI-Key': rapidApiKey,
                'X-RapidAPI-Host': 'youtube-transcript3.p.rapidapi.com'
              }
            });
            
            if (data && data.success && Array.isArray(data.transcript)) {
              const items = data.transcript.map((t: any) => ({
                text: t.text.replace(/\n/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/>>/g, '').trim(),
                start: Number(t.start || t.offset || 0),
                duration: Number(t.duration || 0)
              }));
              const text = items.map(i => i.text).join(' ');
              console.log(`[PASS] RapidAPI success on attempt ${attempt}`);
              return res.json({ text, items });
            }
          } catch (e: any) {
            console.warn(`RapidAPI failed on attempt ${attempt}:`, e.message);
          }
        }

        // 2. Try Python extraction (Local fallback)
        try {
          let stdout = '';
          const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
          try {
            const res = await execAsync(`${pythonCmd} -m youtube_transcript_api ${videoId} --languages en --format json`);
            stdout = res.stdout;
          } catch (pyErr: any) {
            const altCmd = process.platform === 'win32' ? 'python3' : 'python';
            const res = await execAsync(`${altCmd} -m youtube_transcript_api ${videoId} --languages en --format json`);
            stdout = res.stdout;
          }

          let list = JSON.parse(stdout);
          if (Array.isArray(list) && Array.isArray(list[0])) list = list[0];

          if (list && list.length > 0) {
            const items = list.map((t: any) => ({
              text: t.text.replace(/\n/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/>>/g, '').trim(),
              start: Number(t.start || t.offset || 0),
              duration: Number(t.duration || 0)
            }));
            const text = items.map(i => i.text).join(' ');
            console.log(`[PASS] Python success on attempt ${attempt}`);
            return res.json({ text, items });
          }
        } catch (pyOuterErr: any) {
          console.warn(`Python failed on attempt ${attempt}:`, pyOuterErr.message);
        }

        // 3. Node.js Fallback
        try {
          const { YoutubeTranscript } = await import('youtube-transcript');
          if (attempt > 1) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

          const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
          if (transcript && transcript.length > 0) {
            const items = transcript.map(t => ({
              text: t.text.replace(/\n/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/>>/g, '').trim(),
              start: Number(t.offset || t.start || 0),
              duration: Number(t.duration || 0)
            }));
            const text = items.map(i => i.text).join(' ');
            console.log(`[PASS] Node.js success on attempt ${attempt}`);
            return res.json({ text, items });
          }
        } catch (nodeErr: any) {
          console.warn(`Node.js failed on attempt ${attempt}:`, nodeErr.message);
        }
        
        throw new Error('All transcript extraction methods failed for this attempt');
      } catch (err: any) {
        lastError = err;
        if (attempt === MAX_RETRIES + 1) {
          console.error(`Final failure for ${videoId}:`, err);
          return res.status(500).json({ error: '자막을 가져올 수 없습니다. 자막이 비활성화된 영상이거나 지역 제한이 있을 수 있습니다.' });
        }
      }
    }

    // Final failure
    return res.status(404).json({
      error: '자막 추출에 반복적으로 실패했습니다.',
      details: lastError?.message,
      suggestion: '잠시 후 다시 시도하거나, 다른 영상을 사용해 주세요.'
    });
  } catch (error: any) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: '자막을 가져오는데 실패했습니다. 비공개 영상이거나 자막이 비활성화되어 있을 수 있습니다.' });
  }
});

app.post('/api/add-punctuation', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for punctuation' });
    }

    const systemPrompt = `
You are an expert English editor. The user provides a raw transcript (e.g., from YouTube) that lacks proper punctuation and capitalization.
Your task is to reconstruct the text with correct punctuation (periods, commas, question marks, exclamation marks) and capitalization.
CRITICAL RULES:
1. Keep the exact original words in the same order. Do not add, remove, or change any words.
2. Output ONLY the punctuated text. Do not include any explanations, markdown, or intros.
`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Handle chunking to avoid output token limits and Rate Limits
    const words = text.split(/\s+/);
    const CHUNK_SIZE = 2000; // ~2000 words per chunk
    const punctuatedChunks = [];

    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
        const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
        
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nRaw text:\n${chunk}` }] }],
        });
        
        punctuatedChunks.push(result.response.text() || "");
        
        // Wait 2.5 seconds between chunks to avoid free tier rate limit burst issues
        if (i + CHUNK_SIZE < words.length) {
            await new Promise(resolve => setTimeout(resolve, 2500));
        }
    }

    const punctuatedText = punctuatedChunks.join(' ').replace(/\n/g, ' ');
    
    res.json({ text: punctuatedText });
  } catch (error: any) {
    console.error('Error adding punctuation:', error);
    if (error.status === 429 || error.message?.includes('429')) {
      if (error.message?.includes('monthly spending cap')) {
        return res.status(429).json({ error: 'Gemini API 프로젝트의 월간 사용량 한도(Spending Cap)를 초과했습니다. Google AI Studio에서 결제/한도 설정을 확인하거나 새로운 API 키를 발급받으세요.' });
      }
      return res.status(429).json({ error: '현재 Gemini API 요금제(무료) 요청 한도를 초과했습니다. 긴 구간을 전처리하다가 발생했을 수 있습니다. 잠시 후 다시 시도해 주세요.' });
    }
    res.status(500).json({ error: 'Failed to add punctuation' });
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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nRaw text:\n${text}` }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    let responseText = response.response.text() || "";
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

    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "No API KEY" });
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nInput text:\n${text}` }] }],
      generationConfig: {
        responseMimeType: 'text/plain'
      }
    });

    const outputText = response.response.text() || text;
    console.log("=== SPEAKING GUIDE RAW OUTPUT ===");
    console.log(outputText.substring(0, 200) + '...');

    res.json({ guideText: outputText });
  } catch (error: any) {
    console.error('Error generating speaking guide:', error);
    // Graceful fallback: return the original text if AI fails
    res.json({ guideText: req.body.text });
  }
});

app.post('/api/analyze-fast', async (req, res) => {
  try {
    console.time('analyze-fast-total');
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const systemPrompt = `
You are an expert English teacher, editor, and pronunciation coach for Korean learners.
The user will provide a raw transcript chunk. Your job is to process this text in ONE pass and return a JSON object with the following exact structure:

{
  "fullText": "The text with filler words (um, uh, you know, repeated words) removed, and properly formatted into logical paragraphs.",
  "guideText": "The exact same paragraphs as fullText, but formatted for speaking practice: Insert a forward slash ( / ) at natural pause boundaries, and wrap words that carry primary sentence stress with double asterisks (**word**). MUST preserve the paragraph breaks (\\n\\n).",
  "sentences": ["Sentence 1 from the cleaned text.", "Sentence 2 from the cleaned text."],
  "analysisData": {
    "word_order": [
      {
        "original": "English sentence",
        "blocks": [
          { "text": "Meaningful chunk 1 (e.g., I went)", "role": "Korean role (e.g. 주어+동사)", "type": "core" },
          { "text": "Meaningful chunk 2 (e.g., to the store)", "role": "Korean role (e.g. 장소 부사구)", "type": "tail" }
        ],
        "thinking_flow_ko": "Korean explanation of the native thinking flow, explicitly highlighting how the core conclusion (주어+동사) is thrown first within 1 second, followed by attaching the tail parts like a train.",
        "variation": {
          "type": "시제 변경, 가정법 변환, 방향 전환 등 뉘앙스 변조 유형",
          "target_block_index": 0,
          "new_block_text": "I should have gone",
          "nuance_ko": "Core를 후회의 가정법으로 변조하면, 꼬리는 그대로 둔 채 '상점에 갔어야 했는데 안 갔다'는 아쉬움의 뉘앙스로 180도 바뀝니다."
        }
      }
    ]
  }
}

CRITICAL INSTRUCTIONS:
1. Analyze the text provided below. 
2. In the "sentences" array, extract a MAXIMUM of 10 of the most important or difficult sentences from the cleaned text. DO NOT extract every single sentence if there are more than 10.
3. In "analysisData.word_order", there MUST be exactly one item for EVERY sentence in the "sentences" array. The length of both arrays must match.
4. For the "blocks" array, segment the sentence into Meaningful Chunks. Use "type": "core" for the Subject+Verb/Object, and "type": "tail" for attachments (prepositions, relative clauses).
   - CRITICAL: The "role" field MUST be the "직독직해 한글 번역 (Korean Translation)" of that block (e.g. "나는 희망했어", "이 신혼여행이 ~일 거라고"). DO NOT use grammar terms like "주어+동사".
5. For the "variation" object, pick EXACTLY ONE block (usually the core or a prepositional tail) and modify it to completely change the nuance. Provide the index of the block changed in "target_block_index" (0-indexed based on the "blocks" array).
6. Return ONLY valid JSON.
`;

    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "No API KEY" });
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.time('analyze-fast-gemini');
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nInput Text:\n${text}` }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });
    console.timeEnd('analyze-fast-gemini');

    if (!response.response.text()) throw new Error("No response text from Gemini");

    try {
      const parsedData = JSON.parse(response.response.text().trim());
      console.timeEnd('analyze-fast-total');
      res.json(parsedData);
    } catch (e) {
      console.error("Failed to parse AI JSON:", response.response.text());
      res.status(500).json({ error: "AI returned invalid JSON" });
    }

  } catch (error: any) {
    console.error('Error in /api/analyze-fast:', error);
    if (error.status === 429 || error.message?.includes('429')) {
      if (error.message?.includes('monthly spending cap')) {
        return res.status(429).json({ error: 'Gemini API 프로젝트의 월간 사용량 한도(Spending Cap)를 초과했습니다. Google AI Studio에서 결제/한도 설정을 확인하거나 새로운 API 키를 발급받으세요.' });
      }
      return res.status(429).json({ error: '현재 Gemini API 요금제(무료) 요청 한도를 초과했습니다. 약 1분 후 다시 시도해주세요.' });
    }
    res.status(500).json({ error: `Internal server error: ${error.message || 'Unknown'}` });
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
        { "text": "Meaningful chunk 1 (e.g., I went)", "role": "Korean role (e.g. 주어+동사)", "type": "core" },
        { "text": "Meaningful chunk 2 (e.g., to the store)", "role": "Korean role (e.g. 장소 부사구)", "type": "tail" },
        { "text": "Meaningful chunk 3 (e.g., to buy some milk)", "role": "Korean role (e.g. 목적)", "type": "tail" }
      ],
      "thinking_flow_ko": "Korean explanation of the native thinking flow, explicitly highlighting how the core conclusion (주어+동사) is thrown first within 1 second, followed by attaching the tail parts (전치사구, 관계사절 등) like a train.",
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
\${batchSentences}
"""

CRITICAL INSTRUCTIONS:
1. You MUST extract EVERY SINGLE sentence provided in the text block above into the "word_order" array.
2. For the "blocks" array, segment the sentence into Meaningful Chunks (Sense Groups) rather than single words. A chunk should contain 2-4 words that naturally go together (e.g., "in the morning", "I want to", "going to the park").
   - You MUST categorize each chunk using the "type" property as either "core" (the 1-second conclusion: Subject + Verb/Object) or "tail" (attachments like prepositions, relative clauses, to-infinitives, etc.).
   - Usually, there is only one "core" chunk at the very beginning, and the rest are "tail" chunks.
3. DO NOT invent, hallucinate, or generate placeholder sentences. Use only the exact sentences provided.
4. Since \${sentences.length} sentences are provided, there MUST be exactly \${sentences.length} items in the "word_order" array.
5. For EACH item in the "word_order" array, you MUST generate a unique "quiz" object tailored specifically to that sentence's grammar, vocabulary, or word order.
6. For "phrasal_verbs" and "tricky_prepositions", extract the 1-3 most important items found across ALL the sentences combined.
7. Ensure the output is strictly valid JSON matching the exact schema provided.
`;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing in .env" });
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    if (!response.response.text()) throw new Error("No response text from Gemini");

    try {
      const parsedData = JSON.parse(response.response.text().trim());
      // hasMore logic is now handled by the frontend
      res.json(parsedData);
    } catch (e) {
      console.error("Failed to parse AI JSON:", response.response.text());
      res.status(500).json({ error: "AI returned invalid JSON" });
    }

  } catch (error: any) {
    console.error('Error in /api/analyze:', error);
    if (error.status === 429 || error.message?.includes('429')) {
      return res.status(429).json({ error: '현재 Gemini API 요금제(무료) 요청 한도를 초과했습니다. 약 1분 정도 기다렸다가 다시 시도해 주세요. (429 Rate Limit)' });
    }
    res.status(500).json({ error: `Internal server error: ${error.message || 'Unknown'}` });
  }
});

app.post('/api/chat-aha-feedback', async (req, res) => {
  try {
    const { conversation } = req.body;
    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: 'Valid conversation array is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing in .env" });
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const systemPrompt = `
You are a friendly, encouraging Native English Tutor. 
Your student is sharing an "Aha! Moment" — a realization they just had about English nuances (like prepositions or phrasal verbs).
Acknowledge their insight, validate it, and provide a tiny, memorable tip or a natural example sentence to reinforce their learning.
Keep your response concise, warm, and highly relevant to their specific realization. Respond primarily in Korean, but use English for examples.
Do NOT use markdown headers, just text and emojis.
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    // The frontend sends [{role: 'user', content: '...'}, {role: 'model', content: '...'}]
    // Map to what the legacy SDK expects: {role: 'user', parts: [{text: '...'}]}
    const history = conversation.map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));

    // Start chat with history (excluding the very last user message)
    const chat = model.startChat({
      history: history.slice(0, -1),
      generationConfig: {
        temperature: 0.7,
      }
    });

    const latestMessage = history[history.length - 1].parts[0].text;
    const result = await chat.sendMessage(latestMessage);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("No response text from Gemini");

    res.json({ reply: text });
  } catch (error: any) {
    console.error('Error in /api/chat-aha-feedback:', error);
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Quota') || error.message?.includes('retryDelay')) {
      return res.status(429).json({ error: '현재 AI 튜터 응답 한도(무료 요금제)를 초과했습니다. 약 10초 정도 기다렸다가 "튜터 답변 다시 요청하기" 버튼을 눌러주세요. (429 Rate Limit)' });
    }
    res.status(500).json({ error: `메시지 전송에 실패했습니다: ${error.message || 'Unknown server error'}` });
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
