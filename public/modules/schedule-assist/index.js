require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const cron = require('node-cron');
const { submitJadual } = require('./jadual-importer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function analyzeScheduleImage(apiKey, imageBase64) {
    if (!apiKey || apiKey.trim() === '') {
        apiKey = process.env.FALLBACK_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "SILA_GANTIKAN_DENGAN_API_KEY_MASTER";
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    const prompt = `
Anda adalah pakar pengecaman jadual waktu sekolah. Sila analisis gambar jadual waktu kelas ini dan ekstrak senarai kelas dan mata pelajaran.
Anda MESTI memulangkan data HANYA dalam format array JSON tulen seperti contoh di bawah. Tiada teks penerangan, tiada markdown.

PANDUAN PEMETAAN ID:
Untuk "class_id", gunakan format seperti "cg_secondary-form1", "cg_secondary-form2", "cg_secondary-form3", "cg_secondary-form4", "cg_secondary-form5".
Untuk "subject_id", teka kategori yang paling tepat. Contoh:
- Matematik: "sg_science_math-mathematics", "sg_science_math-add_math"
- Sains/Fizik/Kimia/Biologi: "sg_science_math-science", "sg_science_math-physics", "sg_science_math-chemistry", "sg_science_math-biology"
- Bahasa Melayu: "sg_language-bmelayu"
- Bahasa Inggeris: "sg_language-english"
- Sejarah: "sg_arts-history"
- PJPK: "sg_arts-pjpk"
- Geografi: "sg_arts-geography"
- RBT: "sg_technology-rbt"
- Pendidikan Islam: "sg_religion-pi"
- Jawi: "sg_religion-jawi"
- Bahasa Arab: "sg_language-barab"

CONTOH OUTPUT JSON:
[
    {
        "subject_id": "sg_science_math-mathematics",
        "subject_text": "Matematik",
        "class_id": "cg_secondary-form2",
        "session_text": "2 JABIR",
        "sessions": 2,
        "day": "Isnin",
        "time": "08:00 - 09:00"
    }
]

Arahan Tambahan:
- "day" merujuk kepada hari kelas tersebut berlangsung.
- "time" merujuk kepada slot masa kelas tersebut.
- "sessions" merujuk kepada tempoh atau bilangan waktu berterusan bagi slot tersebut (contohnya jika 1 slot 30 minit, 08:00-09:00 = 2 sesi).
- "subject_text" mestilah NAMA SUBJEK penuh (bukan singkatan). Jika jadual menggunakan singkatan (seperti MM, FZK, PJK), tukarkan kepada nama penuh (contoh: Matematik, Fizik, Pendidikan Jasmani Kesihatan).
- "session_text" MESTILAH NAMA KELAS penuh. Jika jadual menggunakan singkatan kelas (contoh: 5B, 4F, 2J), sila panjangkannya kepada tekaan nama penuh yang paling logik (contoh: 5 BESTARI, 4 FIRDAUS, 2 JUPITER).
- Pastikan mematuhi struktur JSON ini dengan ketat. Return tulen JSON array sahaja (tanpa backticks).
`;

    const isOpenRouter = apiKey.startsWith('sk-or-');
    let responseText = "";

    if (isOpenRouter) {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                        ]
                    }
                ],
                temperature: 0.2,
                max_tokens: 4000
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message || "OpenRouter API Error");
        responseText = data.choices[0].message.content.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
    } else {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/jpeg"
                }
            }
        ]);
        responseText = result.response.text().trim().replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    return JSON.parse(responseText);
}

async function runAutomation(onProgress = () => {}, onScheduleExtracted = () => {}, credentials = {}, apiKey = null, imageBase64 = null) {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    console.log = (...args) => {
        originalConsoleLog(...args);
        onProgress(args.join(' '));
    };
    console.error = (...args) => {
        originalConsoleError(...args);
        onProgress('ERROR: ' + args.join(' '));
    };

    console.log(`[${new Date().toISOString()}] Memulakan Automasi Jadual Waktu...`);
    try {
        let lessons = null;
        
        if (imageBase64) {
            console.log("Menganalisis jadual waktu menggunakan AI...");
            lessons = await analyzeScheduleImage(apiKey, imageBase64);
            if (lessons && lessons.length > 0) {
                onScheduleExtracted(lessons);
            }
        }
        
        if (!lessons || lessons.length === 0) {
            console.log("Tiada jadual dijumpai dalam imej. Membatalkan operasi.");
        } else {
            console.log(`Berjaya mengekstrak jadual. Memasukkan ke dalam sistem ASIE...`);
            await submitJadual(lessons, credentials);
            console.log(`[${new Date().toISOString()}] Proses import jadual selesai!`);
        }
    } catch (error) {
        console.error("Ralat semasa import jadual:", error);
    } finally {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    }
}

if (require.main === module) {
    runAutomation();
}

module.exports = { runAutomation, analyzeScheduleImage };
