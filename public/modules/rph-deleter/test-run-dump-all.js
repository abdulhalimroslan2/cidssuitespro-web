const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: './auth.json' });
    const page = await context.newPage();
    
    let allText = "";
    
    for (let m = 1; m <= 12; m++) {
        await page.goto(`https://asiemodel.net/model/search9.php?action=listmiw&ml=${m}&yl=2026`, { waitUntil: 'domcontentloaded' });
        const rows = await page.locator('tr.miw_row').elementHandles();
        for (const row of rows) {
            allText += await row.innerText() + "\n================\n";
        }
    }
    
    fs.writeFileSync('all_miw.txt', allText);
    console.log("Done dumping");
    
    await browser.close();
})();
