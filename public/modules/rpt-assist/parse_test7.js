const str = `This is some text with no tabs and no SP and no date
Another line here
And a third one`;

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
               // ...
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
    
    return results.filter(r => r.mingguKalendar || r.bidangPembelajaran || r.standardPembelajaran);
}

try {
    let res = parseData(str);
    console.log("Parsed:", res);
} catch(e) {
    console.error(e);
}
