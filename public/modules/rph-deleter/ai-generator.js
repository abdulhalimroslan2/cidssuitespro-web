require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateRPH(lessonDetails, sessionIndex = 0, apiKey = null) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-flash-lite-latest",
        generationConfig: {
            temperature: 0.9
        }
    });

    const prompt = `Tolong hasilkan Rancangan Pengajaran Harian (RPH) berdasarkan silibus ini:

Bidang Pembelajaran: ${lessonDetails.bidang}
Tajuk Pembelajaran: ${lessonDetails.tajuk}
Standard Kandungan: ${lessonDetails.kandungan}
Standard Pembelajaran: ${lessonDetails.standard}

Sila patuhi SEMUA arahan di bawah dengan ketat:

1. Create a 5E Bybee instructional lesson plan (Engage-Pelibatan, Explore-Penerokaan, Explain-Penerangan, Elaborate-Pengembangan, Evaluate-Penilaian) based on fun hands-on activities (duration about 0.5 hour).
2. First, must provide the objective learning based on the above topic that fulfilled the ABCD criteria (Audience, Behaviour, Condition, Degree). 
   - Audience: Biasanya ditulis sebagai "murid".
   - Behaviour: Mesti boleh diukur, diperhati dan spesifik.
   - Condition: Apa alat/rujukan yang digunakan.
   - Degree: Had masa, bilangan jawapan betul, atau ketepatan (cth: 90%).
   - CONTOH PENULISAN OBJEKTIF: "Di akhir pembelajaran, murid akan dapat mengira nilai tekanan atmosfera menggunakan sekurang-kurangnya dua unit dengan berpandukan nota mencapai ketepatan 90%."
3. DO NOT write the output of these words in the objective and in the lesson plan body: "(tingkah laku)", "(situasi)", "(aras)", and "5E Bybee".
4. DO NOT provide minutes for each phase. Elaborate more on each phase.
5. Make sure the activities are centred using A4 paper, projector, and teacher's laptop.
6. Any equation must use normal font instead of math font. All math symbols must use normal font, remember forever!
7. Do not include "Tujuan" for each phase.
8. Make sure all the phrases are in Simple Future Tense.
9. If possible, start each activity with "Murid...." instead of "Guru...". Avoid constructing experiments, but emphasize FUN HANDS-ON activities. If the objective is about experimenting, use interactive simulation if possible.
10. Jangan guna perkataan "infografik" sebagai aktiviti murid.
11. ALL in Bahasa Melayu (Malaysia).
12. Jangan letak "────────────────────────────" (Unicode U+2500) pada mana-mana fasa.
13. Jangan letak "======" simbol bagi membezakan antara fasa-fasa.
14. DONT EVER USE THE WORD "diproyeksikan" FOREVER AND EVER!
15. PENTING: JANGAN letakkan bahagian awalan/header seperti "RANCANGAN PENGAJARAN HARIAN", "Mata Pelajaran", "Tingkatan", "Masa", "Profil Pelajar", "Pengetahuan Sedia Ada", "BBM", atau "Refleksi". Mula terus dengan Objektif Pembelajaran, kemudian terus ke fasa-fasa 5E Bybee.
16. PENTING: JANGAN gunakan sebarang tanda asterik (*) atau (**) di dalam ayat. Gunakan tag HTML <b> atau <strong> untuk perkataan yang ingin ditebalkan.
17. Setiap ayat penerangan aktiviti di dalam fasa 5E MESTILAH dimulakan dengan nombor (contoh: 1. Murid... 2. Murid... 3. Murid...) menggunakan senarai HTML <ol><li>.
18. PENTING: Ini adalah penjanaan untuk SESI KE-${sessionIndex + 1} bagi minggu ini untuk kelas ${lessonDetails.session_text}. Sila pastikan set Induksi, Aktiviti Utama (Eksplorasi/Penerangan), dan Penutup adalah 100% UNIK, pelbagai, dan berbeza daripada rancangan sesi-sesi lain bagi mengelakkan persamaan aktiviti.

PENTING: Formatkan jawapan anda 100% dalam tag HTML (gunakan <b> atau <strong> untuk tajuk, <p> untuk perenggan, dan <ol><li> untuk senarai bernombor aktiviti murid) supaya ia boleh terus disalin ke dalam "Rich Text Editor". JANGAN berikan output dalam format markdown \`\`\`html. Berikan terus output HTML tulen sahaja.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Ralat ketika menjana RPH:", error);
    return "<p>Sistem AI gagal menjana RPH untuk masa ini.</p>";
  }
}

module.exports = { generateRPH };
