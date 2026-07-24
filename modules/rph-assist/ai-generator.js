require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateRPH(lessonDetails, sessionIndex = 0, apiKey = null, bbm = []) {
  if (!apiKey || apiKey.trim() === '') {
      apiKey = process.env.FALLBACK_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  }
  try {
    const isOpenRouter = apiKey.startsWith('sk-or-');
    
    const bbmText = bbm.length > 0 ? bbm.join(', ') : 'Papan Putih Mini, Projektor LCD, Kertas A4';
    
    const prompt = `Bertindak sebagai seorang Nazir Sekolah (Pakar Pedagogi). Hasilkan Rancangan Pengajaran Harian (RPH) berprestasi tinggi berpandukan silibus ini:

Bidang: ${lessonDetails.bidang}
Tajuk: ${lessonDetails.tajuk}
Kandungan: ${lessonDetails.kandungan}
Pembelajaran: ${lessonDetails.standard}

ARAHAN WAJIB (SANGAT PENTING):
1. KESAN BAHASA SECARA AUTOMATIK: Anda mesti mengesan bahasa berdasarkan Tajuk dan Bidang di atas. Output KESELURUHAN RPH (termasuk tajuk-tajuk kecil seperti "Profil Pelajar", "Membangun Kemahiran", dll.) WAJIB menggunakan bahasa tersebut secara mutlak!
   - JIKA subjek/silibus adalah Bahasa Arab, KESELURUHAN RPH MESTILAH DITULIS DALAM BAHASA ARAB.
   - JIKA subjek/silibus berkaitan dengan Pendidikan Islam (Jawi) atau tajuknya dalam Jawi, KESELURUHAN RPH MESTILAH DITULIS DALAM TULISAN JAWI SEBENAR (huruf jawi).
   - JIKA subjek/silibus adalah Bahasa Inggeris (English), tulis keseluruhan teks dalam Bahasa Inggeris.
   - JIKA subjek/silibus adalah Bahasa Melayu atau selain di atas, tulis dalam Bahasa Melayu.
2. Format: 5E Bybee (Pelibatan, Penerokaan, Penerangan, Pengembangan, Penilaian). Aktiviti mesti hands-on, KBAT (HOTS), abad ke-21 (PAK-21) dan interaktif.
3. Mulakan terus dengan Objektif Pembelajaran SMART (Audience, Behaviour, Condition, Degree). 
   - Contoh: "Di akhir pembelajaran, murid akan dapat [Tingkah Laku Boleh Diukur] dengan menggunakan [Condition/BBM] mencapai tahap ketepatan [Degree]."
4. Integrasikan Bahan Bantu Mengajar (BBM) ini dalam fasa aktiviti: **${bbmText}**.
5. KETAT: Setiap fasa MESTI diterangkan secara sangat terperinci (detail) dan munasabah (reasonable) untuk mencapai objektif pembelajaran.
6. KETAT: Setiap fasa MESTI mengandungi sekurang-kurangnya 3 item langkah berangka (1., 2., 3.).
7. KETAT: Ayat dan aktiviti yang dijana TIDAK BOLEH sama sekali bertentangan dengan konteks, maksud atau kehendak "Standard Pembelajaran" yang diberikan (termasuklah gaya bahasanya). Semuanya mesti selari 100%.
8. Aktiviti harus berpusatkan murid. Mulakan setiap baris aktiviti dengan perbuatan murid (contoh: "Murid...") bukannya "Guru...".
9. JANGAN tulis perkataan: "(tingkah laku)", "(situasi)", "(aras)", atau "5E Bybee".
10. JANGAN senaraikan minit masa untuk setiap fasa.
11. JANGAN tulis "Tujuan:" dalam fasa.
12. JANGAN guna perkataan "infografik". Jangan guna kata "diproyeksikan".
13. JANGAN guna jadual markdown, asterik (*), sengkang panjang (───) atau garis (===).
14. HARAM DAN DILARANG SAMA SEKALI memasukkan mana-mana bahagian berikut dalam RPH: "Profil Pelajar", "MENYUSUN STRATEGI (STRATEGIZE)", "Dimensi 2: Membangun - Kemahiran", "Dimensi 3: Membentuk - Karakter", "Dimensi 4: Menerap - Pembelajaran-Meta".
15. UNTUK BAHAGIAN REFLEKSI: JANGAN masukkan statistik seperti "Jumlah Pelajar", "Kehadiran Pelajar", atau tajuk "(i) Impak Pembelajaran". Anda MESTI terus mulakan perenggan Refleksi dengan ayat: "Pembelajaran hari ini menunjukkan..."
16. Setiap fasa MESTI menggunakan senarai HTML <ol><li> bernombor untuk langkah aktiviti yang sekurang-kurangnya 3 item tadi.
17. Ini adalah penjanaan untuk SESI KE-${sessionIndex + 1} minggu ini bagi kelas ${lessonDetails.session_text}. Pastikan aktiviti 100% UNIK dari sesi sebelumnya.

PENTING: Output MESTI dalam format HTML tulen (gunakan <b>, <strong>, <p>, <ol>, <li>). JANGAN ada \`\`\`html di pangkal atau hujung.`;

    if (isOpenRouter) {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.9,
                max_tokens: 4000
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message || "OpenRouter API Error");
        return data.choices[0].message.content.trim();
    } else {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-flash-lite-latest",
            generationConfig: {
                temperature: 0.9
            }
        });
        const result = await model.generateContent(prompt);
        const resultResponse = await result.response;
        return resultResponse.text().trim();
    }
  } catch (error) {
    console.error("Ralat ketika menjana RPH:", error);
    return "<p>Sistem AI gagal menjana RPH untuk masa ini.</p>";
  }
}

module.exports = { generateRPH };
