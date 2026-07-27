const str = `Minggu	Tarikh	Tema	Bidang Pembelajaran	Standard Kandungan	Standard Pembelajaran	Catatan
2	19 JAN - 23 JAN	Tema 1: MEKANIK NEWTON	1.0 Daya dan Gerakan II	1.1 Daya Paduan	1.1.1 Menyatakan maksud daya paduan.	17 Jan Isra' Mikraj
2	19 JAN - 23 JAN	Tema 1: MEKANIK NEWTON	1.0 Daya dan Gerakan II	1.1 Daya Paduan	1.1.2 Menentukan daya paduan.	17 Jan Isra' Mikraj
3	26 JAN - 30 JAN	Tema 1: MEKANIK NEWTON	1.0 Daya dan Gerakan II	1.2 Leraian Daya	1.2.1 Memerihalkan leraian daya.	
3	26 JAN - 30 JAN	Tema 1: MEKANIK NEWTON	1.0 Daya dan Gerakan II	1.2 Leraian Daya	1.2.2 Menyelesaikan masalah melibatkan daya paduan dan leraian daya.`;

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
        let minggu = "", tarikhDari = "", tarikhHingga = "";
        let tema = "", bidang = "", sk = "", sp = "", obj = "", krik = "";
        
        if (cols.length < 3) {
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
            
            let dateMatch = str.match(/(\d{1,2}\s+[a-zA-Z]+)\s*-\s*(\d{1,2}\s+[a-zA-Z]+)/);
            if (dateMatch) {
                tarikhDari = dateMatch[1];
                tarikhHingga = dateMatch[2];
            }
            
            let mingguMatch = str.match(/^(\d+)/);
            if (mingguMatch) {
                minggu = mingguMatch[1];
            }
        } else {
            let unusedCols = [...cols];
            
            let mIdx = unusedCols.findIndex(c => /^M?\s*\d+$/i.test(c) || /^Minggu\s*\d+/i.test(c));
            if (mIdx !== -1) {
                let mMatch = unusedCols[mIdx].match(/\d+/);
                if (mMatch) minggu = mMatch[0];
                unusedCols.splice(mIdx, 1);
            }
            
            let tIdx = unusedCols.findIndex(c => /\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?\s*[-–]\s*\d{1,2}/i.test(c) || /\d{1,2}[\/\-.]\d{1,2}/.test(c));
            if (tIdx !== -1) {
                let tStr = unusedCols[tIdx];
                let dateMatch = tStr.match(/(\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?\s*[-–]\s*\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\s*[-–]\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\/\-.]\d{1,2}\s*[-–]\s*\d{1,2}[\/\-.]\d{1,2})/i);
                if (dateMatch) {
                    let dStr = dateMatch[1];
                    let parts = dStr.split(/[-–]/);
                    if (parts.length >= 2) { tarikhDari = parts[0].trim(); tarikhHingga = parts[1].trim(); }
                    let rest = tStr.replace(dateMatch[0], '').trim();
                    if (rest) tema = rest;
                } else { tarikhDari = tStr; }
                unusedCols.splice(tIdx, 1);
            }
            
            let spIdx = unusedCols.findIndex(c => /\d+\.\d+\.\d+/.test(c));
            if (spIdx !== -1) { sp = unusedCols[spIdx]; unusedCols.splice(spIdx, 1); }
            
            let skIdx = unusedCols.findIndex(c => /\d+\.\d+/.test(c));
            if (skIdx !== -1) {
                let skStr = unusedCols[skIdx];
                let matches = [...skStr.matchAll(/(\d+\.\d+)/g)];
                if (matches.length >= 2) {
                    let splitIdx = matches[1].index;
                    bidang = skStr.substring(0, splitIdx).trim();
                    sk = skStr.substring(splitIdx).trim();
                } else { sk = skStr; }
                unusedCols.splice(skIdx, 1);
            }
            
            if (unusedCols.length > 0 && !tema) tema = unusedCols.shift();
            if (unusedCols.length > 0 && !bidang) bidang = unusedCols.shift();
            if (unusedCols.length > 0) obj = unusedCols.shift();
            if (unusedCols.length > 0) krik = unusedCols.shift();
        }
        
        results.push({ mingguKalendar: minggu, tarikhDari, tarikhHingga, bidangPembelajaran: tema, tajukPembelajaran: bidang, standardKandungan: sk, standardPembelajaran: sp, objektifPembelajaran: obj, kriteriaKejayaan: krik });
    }
    
    let filtered = results.filter(r => {
        let text = Object.values(r).join(" ").toLowerCase();
        if (text.trim() === "") return false;
        if (text.includes("minggu") && text.includes("tarikh") && !r.mingguKalendar.match(/\d/)) return false;
        return true;
    });

    // MERGE LOGIC
    let merged = [];
    let currentWeek = null;
    let currentItem = null;

    for (let r of filtered) {
        let week = r.mingguKalendar;
        if (!week && currentWeek) {
            week = currentWeek; // inherit previous week if empty
        }

        if (week && week === currentWeek && currentItem) {
            // merge into currentItem
            if (r.standardKandungan && !currentItem.standardKandungan.includes(r.standardKandungan)) {
                currentItem.standardKandungan += (currentItem.standardKandungan ? "\n" : "") + r.standardKandungan;
            }
            if (r.standardPembelajaran && !currentItem.standardPembelajaran.includes(r.standardPembelajaran)) {
                currentItem.standardPembelajaran += (currentItem.standardPembelajaran ? "\n" : "") + r.standardPembelajaran;
            }
            if (r.bidangPembelajaran && !currentItem.bidangPembelajaran.includes(r.bidangPembelajaran)) {
                currentItem.bidangPembelajaran += (currentItem.bidangPembelajaran ? " " : "") + r.bidangPembelajaran;
            }
            if (r.tajukPembelajaran && !currentItem.tajukPembelajaran.includes(r.tajukPembelajaran)) {
                currentItem.tajukPembelajaran += (currentItem.tajukPembelajaran ? " " : "") + r.tajukPembelajaran;
            }
            if (r.objektifPembelajaran && !currentItem.objektifPembelajaran.includes(r.objektifPembelajaran)) {
                currentItem.objektifPembelajaran += (currentItem.objektifPembelajaran ? "\n" : "") + r.objektifPembelajaran;
            }
            if (r.kriteriaKejayaan && !currentItem.kriteriaKejayaan.includes(r.kriteriaKejayaan)) {
                currentItem.kriteriaKejayaan += (currentItem.kriteriaKejayaan ? "\n" : "") + r.kriteriaKejayaan;
            }
        } else {
            // new item
            currentWeek = week;
            currentItem = { ...r, mingguKalendar: week };
            merged.push(currentItem);
        }
    }

    return merged;
}

console.log(JSON.stringify(parseData(str), null, 2));
