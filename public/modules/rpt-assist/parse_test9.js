const fs = require('fs');
const popupCode = fs.readFileSync('/Users/halimroslan/RPH Automator Baru/CIDS_RPT_AI_Assist (2)/popup.js', 'utf8');

const parseDataMatch = popupCode.match(/function parseData\(str\) \{([\s\S]*?)\}\n\s*const results = parseData\(csvData\);/);
if (!parseDataMatch) {
    console.error("Could not find parseData in popup.js");
    process.exit(1);
}

const parseDataFuncStr = "function parseData(str) {" + parseDataMatch[1] + "}";
eval(parseDataFuncStr);

const str = `5       09 FEB - 13 FEB Tema 1: MEKANIK
NEWTON  2.0 Tekanan     2.3 Tekanan Gas 2.3.1
Menentukan tekanan gas dengan menggunakan
manometer.`;

console.log("Parsed:", parseData(str));
