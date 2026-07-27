function parseData(str) {
    const rows = [];
    const lines = str.split('\n');
    for (let line of lines) {
        if (!line.trim()) continue;
        let cols = line.split(/\t/);
        if (cols.length < 3) {
            cols = line.split(/ {2,}/);
        }
        if (cols.length >= 3) {
            rows.push(cols.map(c => c.trim()));
        }
    }
    
    const results = [];
    for (let cols of rows) {
        let minggu = "", tarikhDari = "", tarikhHingga = "";
        let tema = "", bidang = "", sk = "", sp = "", obj = "", krik = "";
        
        let unusedCols = [...cols];
        
        // 1. Find Minggu
        let mIdx = unusedCols.findIndex(c => /^M?\s*\d+$/i.test(c) || /^Minggu\s*\d+/i.test(c));
        if (mIdx !== -1) {
            let mMatch = unusedCols[mIdx].match(/\d+/);
            if (mMatch) minggu = mMatch[0];
            unusedCols.splice(mIdx, 1);
        }
        
        // 2. Find Tarikh and split if glued with Tema
        let tIdx = unusedCols.findIndex(c => /\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?\s*[-–]\s*\d{1,2}/i.test(c) || /\d{1,2}[\/\-.]\d{1,2}/.test(c));
        if (tIdx !== -1) {
            let tStr = unusedCols[tIdx];
            // Extract the date part
            let dateMatch = tStr.match(/(\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?\s*[-–]\s*\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\s*[-–]\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\/\-.]\d{1,2}\s*[-–]\s*\d{1,2}[\/\-.]\d{1,2})/i);
            if (dateMatch) {
                let dStr = dateMatch[1];
                let parts = dStr.split(/[-–]/);
                if (parts.length >= 2) {
                    tarikhDari = parts[0].trim();
                    tarikhHingga = parts[1].trim();
                }
                // The rest of the string is Tema
                let rest = tStr.replace(dateMatch[0], '').trim();
                if (rest) tema = rest;
            } else {
                tarikhDari = tStr;
            }
            unusedCols.splice(tIdx, 1);
        }
        
        // 3. Find SP (Standard Pembelajaran)
        let spIdx = unusedCols.findIndex(c => /\d+\.\d+\.\d+/.test(c));
        if (spIdx !== -1) {
            sp = unusedCols[spIdx];
            unusedCols.splice(spIdx, 1);
        }
        
        // 4. Find SK (Standard Kandungan) and split if glued with Bidang
        // E.g., "1.0 Daya dan Gerakan II 1.1 Daya Paduan" -> SK is "1.1 Daya Paduan", Bidang is "1.0 Daya dan Gerakan II"
        let skIdx = unusedCols.findIndex(c => /\d+\.\d+/.test(c));
        if (skIdx !== -1) {
            let skStr = unusedCols[skIdx];
            // find multiple occurrences of X.Y
            let matches = [...skStr.matchAll(/(\d+\.\d+)/g)];
            if (matches.length >= 2) {
                // Split at the second match
                let splitIdx = matches[1].index;
                bidang = skStr.substring(0, splitIdx).trim();
                sk = skStr.substring(splitIdx).trim();
            } else {
                sk = skStr;
            }
            unusedCols.splice(skIdx, 1);
        }
        
        // The remaining columns
        if (unusedCols.length > 0 && !tema) tema = unusedCols.shift();
        if (unusedCols.length > 0 && !bidang) bidang = unusedCols.shift();
        if (unusedCols.length > 0) obj = unusedCols.shift();
        if (unusedCols.length > 0) krik = unusedCols.shift();
        
        results.push({
            mingguKalendar: minggu, tarikhDari, tarikhHingga,
            bidangPembelajaran: tema, tajukPembelajaran: bidang,
            standardKandungan: sk, standardPembelajaran: sp,
            objektifPembelajaran: obj, kriteriaKejayaan: krik
        });
    }
    return results;
}

const input = `2        15 JAN - 19 JAN Tema 1: MEKANIK NEWTON        1.0 Daya dan Gerakan II 1.1 Daya Paduan        1.1.4 Menyelesaikan masalah yang melibatkan daya paduan, jisim dan pecutan suatu objek.        17 Jan Isra' Mikraj`;
console.log(JSON.stringify(parseData(input), null, 2));
