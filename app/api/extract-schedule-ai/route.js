// POST /api/extract-schedule-ai
// Use AI to analyze a schedule image and extract lesson data

import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
  try {
    const body = await request.json();
    const { apiKey, imageBase64 } = body;

    if (!apiKey) {
      return Response.json({ success: false, error: 'API Key diperlukan.' }, { status: 400 });
    }
    if (!imageBase64) {
      return Response.json({ success: false, error: 'Gambar jadual diperlukan.' }, { status: 400 });
    }

    const prompt = `Analisis gambar jadual waktu guru ini. Ekstrak SEMUA slot pengajaran dan kembalikan dalam format JSON array.

Setiap slot mesti mempunyai:
- "subject_text": Nama mata pelajaran (dalam Bahasa Melayu)
- "session_text": Nama kelas (cth: "2 SHUKUR", "4 MAWAR")
- "sessions": Bilangan sesi/slot (biasanya 1 atau 2)
- "day": Hari (Isnin/Selasa/Rabu/Khamis/Jumaat)
- "time": Masa (cth: "08:00 AM - 09:00 AM")

PENTING:
- Jawab HANYA dengan JSON array, tiada teks lain
- Gabungkan slot berturutan untuk matapelajaran + kelas yang sama menjadi 1 entry dengan sessions > 1
- Tukar nama subjek ke Bahasa Melayu jika perlu (English → Bahasa Inggeris, Mathematics → Matematik, etc)

Contoh output:
[
  {"subject_text": "Matematik", "session_text": "2 SHUKUR", "sessions": 2, "day": "Isnin", "time": "08:00 AM - 09:30 AM"},
  {"subject_text": "Bahasa Inggeris", "session_text": "2 RAUDAH", "sessions": 1, "day": "Selasa", "time": "10:00 AM - 10:30 AM"}
]`;

    let lessons;

    if (apiKey.startsWith('sk-or-')) {
      // OpenRouter
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          }],
          temperature: 0.3,
        }),
      });
      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content || '';
      lessons = extractJSON(rawText);
    } else {
      // Google Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType: 'image/jpeg',
          }
        }
      ]);
      const rawText = result.response.text();
      lessons = extractJSON(rawText);
    }

    if (!lessons || !Array.isArray(lessons)) {
      return Response.json({ success: false, error: 'Gagal mengekstrak jadual dari gambar.' }, { status: 500 });
    }

    return Response.json({ success: true, lessons });

  } catch (error) {
    console.error('[extract-schedule-ai] Error:', error);
    return Response.json({
      success: false,
      error: 'Ralat pelayan: ' + error.message
    }, { status: 500 });
  }
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) { try { return JSON.parse(match[1].trim()); } catch {} }
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch {} }
  return null;
}
