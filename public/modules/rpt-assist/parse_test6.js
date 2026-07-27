const str = `Minggu	Tarikh	Tema	Bidang Pembelajaran	Standard Kandungan	Standard Pembelajaran	Catatan
1	12 JAN - 16 JAN	Minggu Pertama Persekolahan	-	-	-	Minggu Pertama Persekolahan
2	19 JAN - 23 JAN	Tema 1: MEKANIK NEWTON	1.0 Daya dan Gerakan II	1.1 Daya Paduan	1.1.1 Menyatakan maksud daya paduan.	17 Jan Isra' Mikraj
2	19 JAN - 23 JAN	Tema 1: MEKANIK NEWTON	1.0 Daya dan Gerakan II	1.1 Daya Paduan	1.1.2 Menentukan daya paduan.	17 Jan Isra' Mikraj`;

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
            // Heavily glued string (no tabs, just single spaces)
            let str = cols.join(" ").trim();
            let spMatch = str.match(/\b\d+\.\d+\.\d+\b/);
            if (spMatch) {
                let parts = str.split(spMatch[0]);
                let beforeSP = parts[0];
                let afterSP = parts[1] || "";
                sp = spMatch[0];
                let skMatches = [...beforeSP.matchAll(/\b\d+\.\d+\b/g)];
                if (skMatches.length >= 2) {
                    let lastSK = skMatches[skMatches.length - 1];
                    bidang = beforeSP.substring(0, lastSK.index).trim();
                    sk = beforeSP.substring(lastSK.index).trim();
                } else if (skMatches.length === 1) {
                    let lastSK = skMatches[0];
                    bidang = beforeSP.substring(0, lastSK.index).trim();
                    sk = beforeSP.substring(lastSK.index).trim();
                } else {
                    bidang = beforeSP.trim();
                }
                sp += " " + afterSP.trim();
            } else {
                bidang = str;
            }
            
            // Try to extract date
            let dateMatch = str.match(/(\d{1,2}\s+[a-zA-Z]+)\s*-\s*(\d{1,2}\s+[a-zA-Z]+)/);
            if (dateMatch) {
                tarikhDari = dateMatch[1];
                tarikhHingga = dateMatch[2];
            }
            
            // Try to extract minggu
            let mingguMatch = str.match(/^(\d+)/);
            if (mingguMatch) {
                minggu = mingguMatch[1];
            }
        } else {
            let unusedCols = [...cols];
            
            // 1. Find Minggu
            let mIdx = unusedCols.findIndex(c => /^\d+$/.test(c.trim()) && c.length <= 2);
            if (mIdx !== -1) { minggu = unusedCols[mIdx]; unusedCols.splice(mIdx, 1); }
            
            // 2. Find Tarikh
            let tIdx = unusedCols.findIndex(c => c.includes("-") && /\d/.test(c) && /[a-zA-Z]/.test(c));
            if (tIdx !== -1) {
                let t = unusedCols[tIdx];
                let pts = t.split("-");
                tarikhDari = pts[0].trim();
                if(pts[1]) tarikhHingga = pts[1].trim();
                unusedCols.splice(tIdx, 1);
            }
            
            // 3. Find SP
            let spIdx = unusedCols.findIndex(c => /\d+\.\d+\.\d+/.test(c));
            if (spIdx !== -1) { sp = unusedCols[spIdx]; unusedCols.splice(spIdx, 1); }
            
            // 4. Find SK
            let skIdx = unusedCols.findIndex(c => /\b\d+\.\d+\b/.test(c) && !/\d+\.\d+\.\d+/.test(c));
            if (skIdx !== -1) { sk = unusedCols[skIdx]; unusedCols.splice(skIdx, 1); }
            
            // 5. The rest goes to Tema / Bidang
            if (unusedCols.length > 0) tema = unusedCols.shift();
            if (unusedCols.length > 0) bidang = unusedCols.shift();
        }
        
        results.push({ mingguKalendar: minggu, tarikhDari, tarikhHingga, bidangPembelajaran: tema, tajukPembelajaran: bidang, standardKandungan: sk, standardPembelajaran: sp, objektifPembelajaran: obj, kriteriaKejayaan: krik });
    }
    
    return results.filter(r => r.mingguKalendar || r.bidangPembelajaran || r.standardPembelajaran);
}

try {
    let res = parseData(str);
    console.log("Parsed:", res);
} catch(e) {
    console.error(e);
}
