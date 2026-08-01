// POST /api/generate-rph
// Server-side RPH generation using AI (Gemini / OpenRouter)
// With auto-retry, rate-limit delay, and fallback models

import { GoogleGenerativeAI } from '@google/generative-ai';

// Models to try in order (fallback chain)
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryGemini(apiKey, prompt, retries = 2) {
  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of GEMINI_MODELS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`[generate-rph] Trying ${modelName} (attempt ${attempt + 1})`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        const json = extractJSON(rawText);
        if (json) return json;
      } catch (err) {
        const is429 = err.message?.includes('429') || err.message?.includes('quota');
        if (is429 && attempt < retries) {
          // Extract retry delay from error or use default
          const delayMatch = err.message.match(/retry in (\d+)/i);
          const waitSec = delayMatch ? parseInt(delayMatch[1]) + 2 : 40;
          console.log(`[generate-rph] Rate limited on ${modelName}. Waiting ${waitSec}s...`);
          await sleep(waitSec * 1000);
          continue;
        }
        if (is429) {
          console.log(`[generate-rph] ${modelName} exhausted, trying next model...`);
          break; // Try next model
        }
        throw err; // Non-429 error, propagate
      }
    }
  }
  return null; // All models exhausted
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { apiKey, lessonDetails, sessionIndex, bbm } = body;

    if (!apiKey) {
      return Response.json({ success: false, error: 'API Key diperlukan.' }, { status: 400 });
    }

    if (!lessonDetails) {
      return Response.json({ success: false, error: 'Maklumat pelajaran diperlukan.' }, { status: 400 });
    }

    const bbmText = bbm && bbm.length > 0 ? bbm.join(', ') : 'Buku teks, Lembaran kerja';

    const prompt = `Anda adalah pakar pedagogi Malaysia. Jana RPH (Rancangan Pengajaran Harian) menggunakan model 5E Bybee untuk pelajaran berikut:

Mata Pelajaran: ${lessonDetails.subject_text || 'Tidak dinyatakan'}
Kelas: ${lessonDetails.session_text || 'Tidak dinyatakan'}
Hari: ${lessonDetails.day || 'Tidak dinyatakan'}
Masa: ${lessonDetails.time || 'Tidak dinyatakan'}
Sesi ke: ${(sessionIndex || 0) + 1}
BBM: ${bbmText}

Sila jana RPH dalam format berikut (WAJIB JSON sahaja, tiada teks lain):

{
  "tema": "...",
  "tajuk": "...",
  "standard_kandungan": "...",
  "standard_pembelajaran": "...",
  "objektif_pembelajaran": "...",
  "aktiviti_pdp": {
    "engage": "...",
    "explore": "...",
    "explain": "...",
    "elaborate": "...",
    "evaluate": "..."
  },
  "elemen_merentas_kurikulum": "...",
  "bahan_bantu_mengajar": "${bbmText}",
  "refleksi": "...",
  "catatan": "..."
}

PENTING: Jawab dalam Bahasa Melayu. Output WAJIB JSON sahaja.`;

    let rphContent;

    // Check if it's an OpenRouter key
    if (apiKey.startsWith('sk-or-')) {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
      const orData = await orRes.json();
      const rawText = orData.choices?.[0]?.message?.content || '';
      rphContent = extractJSON(rawText);
    } else {
      // Google Gemini SDK — with retry & model fallback
      rphContent = await tryGemini(apiKey, prompt);
    }

    if (!rphContent) {
      return Response.json({
        success: false,
        error: 'Kuota API habis untuk semua model. Sila tunggu beberapa minit atau guna API Key baharu dari https://aistudio.google.com/apikey'
      }, { status: 429 });
    }

    return Response.json({ success: true, rphContent });

  } catch (error) {
    console.error('[generate-rph] Error:', error);
    return Response.json({
      success: false,
      error: 'Ralat pelayan: ' + error.message
    }, { status: 500 });
  }
}

function extractJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch {}
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch {}
    }
    return null;
  }
}
