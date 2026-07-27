require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const cron = require('node-cron');
const { submitRPH } = require('./rph-submitter');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function analyzeScheduleImage(apiKey, imageBase64, miwDate) {
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
- Sejarah: "sg_humanities-history"
- PJPK: "sg_arts-pjpk"
- Geografi: "sg_humanities-geography"
- RBT: "sg_tech-rbt"
- Pendidikan Islam: "sg_islamic-pi"
- Jawi: "sg_islamic-jawi"
- Bahasa Arab: "sg_language-barab"

CONTOH OUTPUT JSON:
[
    {
        "subject_id": "sg_science_math-mathematics",
        "subject_text": "Matematik",
        "class_id": "cg_secondary-form2",
        "session_text": "2 JABIR",
        "sessions": 2
    },
    {
        "subject_id": "sg_arts-pjpk",
        "subject_text": "Pendidikan Jasmani",
        "class_id": "cg_secondary-form5",
        "session_text": "5 BUKHARI",
        "sessions": 1
    }
]

Arahan Tambahan:
- "sessions" merujuk kepada bilangan kali kelas tersebut muncul dalam jadual untuk satu minggu. Jika 2 masa berturut-turut (bergabung), ia dikira sebagai 1 sesi (sessions: 1). Jika ia muncul pada hari Isnin dan hari Khamis, ia dikira sebagai 2 sesi (sessions: 2). Gabungkan dan kira jumlah 'sessions' bagi setiap 'session_text' (nama kelas) dan 'subject_id' yang unik.
- "subject_text" mestilah NAMA SUBJEK sebenar yang tertulis dalam jadual (cth: "Jawi", "Bahasa Melayu", "Sejarah"). Ini sangat penting untuk pemadanan sistem.
- "session_text" MESTILAH TEKS SEBENAR yang ditulis dalam kotak kelas tersebut pada jadual (cth: "5 BUKHARI", "1 CERDAS"). JANGAN letak nama subjek (seperti "Jawi") atau nama tingkatan umum (seperti "Tingkatan 1"). Pastikan ia adalah NAMA KELAS KHUSUS.
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
    const lessons = JSON.parse(responseText);
    
    if (miwDate) {
        return lessons.map(lesson => ({
            ...lesson,
            miw_date: miwDate
        }));
    }
    return lessons;
}

async function runAutomation(onProgress = () => {}, onScheduleExtracted = () => {}, miwDate = null, credentials = {}, apiKey = null, imageBase64 = null, savedLessons = null, bbm = []) {
    // Intercept console.log to send all logs to the UI
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

    console.log(`[${new Date().toISOString()}] Starting RPH Automation...`);
    if (miwDate) {
        console.log(`Tarikh sasaran UI ditetapkan kepada: ${miwDate}`);
    }
    try {
        let lessons = savedLessons;
        
        if (!lessons && imageBase64) {
            console.log("Menganalisis jadual waktu menggunakan AI...");
            lessons = await analyzeScheduleImage(apiKey, imageBase64, miwDate);
            // Kembalikan jadual yang diekstrak untuk disimpan
            if (lessons && lessons.length > 0) {
                onScheduleExtracted(lessons);
            }
        } else if (lessons) {
            console.log("Jadual tersimpan digunakan (tanpa AI).");
        }
        
        if (!lessons || lessons.length === 0) {
            console.log("Tiada kelas dijumpai dalam jadual. Membatalkan operasi.");
        } else {
            console.log(`Berjaya mengekstrak ${lessons.length} kelas daripada jadual.`);
            // Step 2: Hantar ke ASIE Model
            await submitRPH(lessons, miwDate, credentials, apiKey, bbm);
            console.log(`[${new Date().toISOString()}] RPH Automation completed successfully!`);
        }
    } catch (error) {
        console.error("Error during RPH Automation:", error);
    } finally {
        // Restore console
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    }
}

// Check if running directly or via cron
if (require.main === module) {
    const isCron = process.argv.includes('--cron');
    
    if (isCron) {
        const schedule = process.env.CRON_SCHEDULE || "0 18 * * 0";
        console.log(`Starting cron scheduler with schedule: ${schedule}`);
        cron.schedule(schedule, runAutomation);
    } else {
        // Run immediately
        runAutomation();
    }
}

module.exports = { runAutomation };
