const fs = require('fs');

function mapSubjectId(subjectValue) {
    const s = subjectValue.toLowerCase();
    if (s.includes('math')) return 'sg_science_math-mathematics';
    if (s.includes('add_math')) return 'sg_science_math-add_math';
    if (s.includes('science')) return 'sg_science_math-science';
    if (s.includes('physics')) return 'sg_science_math-physics';
    if (s.includes('chemistry')) return 'sg_science_math-chemistry';
    if (s.includes('biology')) return 'sg_science_math-biology';
    if (s.includes('bmelayu')) return 'sg_language-bmelayu';
    if (s.includes('english')) return 'sg_language-english';
    if (s.includes('history')) return 'sg_humanities-history';
    if (s.includes('pjpk')) return 'sg_arts-pjpk';
    if (s.includes('geography')) return 'sg_humanities-geography';
    if (s.includes('rbt')) return 'sg_tech-rbt';
    if (s.includes('pi') || s.includes('pendidikan islam')) return 'sg_islamic-pi';
    if (s.includes('jawi')) return 'sg_islamic-jawi';
    if (s.includes('barab')) return 'sg_language-barab';
    
    // Fallback guesses based on common text
    if (s.includes('matematik')) return 'sg_science_math-mathematics';
    if (s.includes('fizik')) return 'sg_science_math-physics';
    if (s.includes('melayu')) return 'sg_language-bmelayu';
    
    return 'unknown_subject'; // Should log or handle
}

function mapClassId(className) {
    const match = className.match(/\d/);
    if (match) {
        return `cg_secondary-form${match[0]}`;
    }
    return 'cg_secondary-form1'; // Default
}

function processRawSchedule(rawRows) {
    const grouped = {};
    rawRows.forEach(row => {
        // Gabung jika subject_text dan class_id sama
        const key = `${row.subject}_${row.class}`;
        if (!grouped[key]) {
            grouped[key] = {
                subject_id: mapSubjectId(row.subjectValue || row.subject),
                subject_text: row.subject,
                class_id: mapClassId(row.class),
                session_text: row.class,
                sessions: 1,
                day: row.day, // Just keep the first day for reference if needed
                time: row.time
            };
        } else {
            grouped[key].sessions += 1;
        }
    });
    return Object.values(grouped);
}
