const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: './auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'domcontentloaded' });
    
    fs.writeFileSync('debug_search9_latest.html', await page.content());
    
    const rows = await page.locator('tr.miw_row').elementHandles();
    console.log("Total rows found:", rows.length);
    
    await browser.close();
})();
