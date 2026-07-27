// POST /api/generate-rph
// Server-side RPH generation using AI (Gemini / OpenRouter)

import { GoogleGenerativeAI } from '@google/generative-ai';

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
      // Google Gemini SDK
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      rphContent = extractJSON(rawText);
    }

    if (!rphContent) {
      return Response.json({ success: false, error: 'Gagal mengekstrak JSON dari respons AI.' }, { status: 500 });
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
    // Try direct parse
    return JSON.parse(text);
  } catch {
    // Extract from markdown code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch {}
    }
    // Try to find JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch {}
    }
    return null;
  }
}
