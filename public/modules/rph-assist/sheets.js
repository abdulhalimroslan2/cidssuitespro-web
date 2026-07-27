const { google } = require('googleapis');

async function fetchWeeklyLessons(uiDate = null) {
    // TODO: The user needs to provide:
    // 1. Google Sheets ID
    // 2. The exact MIW calculation logic or date filtering logic to fetch the correct rows
    
    // TODO: Ambil data dari Google Sheets.
    // Buat sementara waktu, kembalikan data mock untuk jadual sebenar.
    let mockData = [
        {
            subject_id: "sg_arts-pjpk",
            class_id: "cg_secondary-form5",
            miw_date: "06-07-2026 — 10-07-2026",
            session_text: "Pendidikan Jasmani",
            sessions: 1
        },
        {
            subject_id: "sg_science_math-mathematics",
            class_id: "cg_secondary-form2",
            miw_date: "06-07-2026 — 10-07-2026",
            session_text: "2 JABIR",
            sessions: 2
        },
        {
            subject_id: "sg_science_math-physics",
            class_id: "cg_secondary-form5",
            miw_date: "06-07-2026 — 10-07-2026",
            session_text: "5 BUKHARI",
            sessions: 2
        },
        {
            subject_id: "sg_science_math-physics",
            class_id: "cg_secondary-form5",
            miw_date: "06-07-2026 — 10-07-2026",
            session_text: "5 FARABI",
            sessions: 2
        },
        {
            subject_id: "sg_science_math-mathematics",
            class_id: "cg_secondary-form4",
            miw_date: "06-07-2026 — 10-07-2026",
            session_text: "4 FARABI",
            sessions: 2
        },
        {
            subject_id: "sg_science_math-mathematics",
            class_id: "cg_secondary-form2",
            miw_date: "06-07-2026 — 10-07-2026",
            session_text: "2 BUKHARI",
            sessions: 2
        }
    ];
    
    if (uiDate) {
        mockData = mockData.map(lesson => ({
            ...lesson,
            miw_date: uiDate
        }));
    }
    
    return mockData;
}

module.exports = { fetchWeeklyLessons };
