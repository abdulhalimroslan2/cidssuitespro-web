function parseGluedLine(line) {
    let minggu = "", tarikhDari = "", tarikhHingga = "";
    let tema = "", bidang = "", sk = "", sp = "", obj = "", krik = "";
    let str = line.trim();
    
    // 1. SP (e.g. 1.1.1)
    let spMatch = str.match(/\b\d+\.\d+\.\d+\b/);
    if (spMatch) {
        let parts = str.split(spMatch[0]);
        let beforeSP = parts[0];
        let afterSP = parts[1];
        
        sp = spMatch[0];
        
        // Next, find SK (e.g. 1.1) in beforeSP
        let skMatches = [...beforeSP.matchAll(/\b\d+\.\d+\b/g)];
        if (skMatches.length >= 2) {
            // Usually the first X.Y is Bidang, the last X.Y is SK
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
        
        // After SP, we might have Objective / Catatan. 
        // We will just put everything in Objectif for now
        obj = afterSP.trim();
    } else {
        // If no SP, we just have before SP
        bidang = str;
    }
    
    // Now extract Minggu & Tarikh from 'bidang' (which contains the beginning of the string)
    // Find Date:
    let dateMatch = bidang.match(/(\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?\s*[-–]\s*\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\s*[-–]\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\/\-.]\d{1,2}\s*[-–]\s*\d{1,2}[\/\-.]\d{1,2})/i);
    
    if (dateMatch) {
        let dStr = dateMatch[1];
        let parts = dStr.split(/[-–]/);
        if (parts.length >= 2) { tarikhDari = parts[0].trim(); tarikhHingga = parts[1].trim(); }
        
        let beforeDate = bidang.substring(0, dateMatch.index).trim();
        tema = bidang.substring(dateMatch.index + dateMatch[0].length).trim();
        
        // extract minggu from beforeDate
        let mMatch = beforeDate.match(/^M?\s*(\d+)/i) || beforeDate.match(/^Minggu\s*(\d+)/i) || beforeDate.match(/^(\d+)/);
        if (mMatch) minggu = mMatch[1];
        
        bidang = tema; // We shift it
        tema = "";
    }
    
    // In many RPTs, "Tema" is the text after Date, and "Bidang" is the X.Y number.
    // Wait, in our split, `bidang` string contains BOTH Tema and Bidang.
    // Let's refine the Tema vs Bidang split.
    // Usually Bidang starts with "1.0" (a X.0 format) or it's just the next part.
    let xZeroMatch = bidang.match(/\b\d+\.0\b/);
    if (xZeroMatch) {
        tema = bidang.substring(0, xZeroMatch.index).trim();
        bidang = bidang.substring(xZeroMatch.index).trim();
    } else {
        tema = bidang;
        bidang = "";
    }

    return { mingguKalendar: minggu, tarikhDari, tarikhHingga, bidangPembelajaran: tema, tajukPembelajaran: bidang, standardKandungan: sk, standardPembelajaran: sp, objektifPembelajaran: obj, kriteriaKejayaan: krik };
}

const input = "2 15 JAN - 19 JAN Tema 1: MEKANIK NEWTON 1.0 Daya dan Gerakan II 1.1 Daya Paduan 1.1.4 Menyelesaikan masalah yang melibatkan daya paduan, jisim dan pecutan suatu objek. 17 Jan Isra' Mikraj";
console.log(JSON.stringify(parseGluedLine(input), null, 2));
