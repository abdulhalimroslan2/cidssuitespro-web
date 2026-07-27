const str = `5       09 FEB - 13 FEB Tema 1: MEKANIK
NEWTON  2.0 Tekanan     2.3 Tekanan Gas 2.3.1
Menentukan tekanan gas dengan menggunakan
manometer.`;

function parseData(str) {
    const rows = [];
    const lines = str.split('\n');
    for (let line of lines) {
        if (!line.trim()) continue;
        let cols = line.split(/\t/);
        if (cols.length < 3) cols = line.split(/ {2,}/);
        rows.push(cols.map(c => c.trim()));
    }
    
    const results = [];
    for (let cols of rows) {
        if (cols[0] && cols[0].toLowerCase().includes('minggu') && cols[1] && cols[1].toLowerCase().includes('tarikh')) {
            continue; // Skip header
        }

        let minggu = "", tarikhDari = "", tarikhHingga = "";
        let tema = "", bidang = "", sk = "", sp = "", obj = "", krik = "";
        
        if (cols.length < 3) {
            let str = cols.join(" ").trim();
            let spMatch = str.match(/\b\d+\.\d+\.\d+\b/);
            if (spMatch) {
               // ... (simulated logic for spMatch)
               sp = spMatch[0];
            } else {
                bidang = str;
            }
            
            let dateMatch = str.match(/(\d{1,2}\s+[a-zA-Z]+)\s*-\s*(\d{1,2}\s+[a-zA-Z]+)/);
            if (dateMatch) {
                tarikhDari = dateMatch[1];
                tarikhHingga = dateMatch[2];
            }
            
            let mingguMatch = str.match(/^(\d+)/);
            if (mingguMatch) {
                minggu = mingguMatch[1];
            }
        }
        
        results.push({ mingguKalendar: minggu, tarikhDari, tarikhHingga, bidangPembelajaran: tema, tajukPembelajaran: bidang, standardKandungan: sk, standardPembelajaran: sp, objektifPembelajaran: obj, kriteriaKejayaan: krik });
    }
    
    return results.filter(r => {
        let text = Object.values(r).join(" ").toLowerCase();
        if (text.trim() === "") return false;
        if (text.includes("minggu") && text.includes("tarikh") && !r.mingguKalendar.match(/\d/)) return false;
        return true;
    });
}

try {
    let res = parseData(str);
    console.log("Parsed:", res);
} catch(e) {
    console.error(e);
}
