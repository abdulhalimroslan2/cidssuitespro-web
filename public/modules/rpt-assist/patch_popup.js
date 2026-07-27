const fs = require('fs');

const path = '../CIDS_RPT_AI_Assist (2)/popup.js';
let js = fs.readFileSync(path, 'utf8');

// Insert logic to handle dashboard toggling at the start of DOMContentLoaded
const insertIdx = js.indexOf('const apiKeyInput = document.getElementById');
if (insertIdx !== -1) {
    const patch = `
    // Dashboard Navigation
    const dashboardView = document.getElementById('dashboardView');
    const rptAssistView = document.getElementById('rptAssistView');
    const btnGoRpt = document.getElementById('btnGoRpt');
    const btnBackDash = document.getElementById('btnBackDash');
    
    if (btnGoRpt && btnBackDash) {
        btnGoRpt.addEventListener('click', () => {
            dashboardView.style.display = 'none';
            rptAssistView.style.display = 'block';
        });
        
        btnBackDash.addEventListener('click', () => {
            rptAssistView.style.display = 'none';
            dashboardView.style.display = 'flex';
        });
    }

`;
    js = js.substring(0, insertIdx) + patch + js.substring(insertIdx);
    fs.writeFileSync(path, js);
    console.log('popup.js patched');
}
