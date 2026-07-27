const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: './auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/search9.php?action=listmiw&ml=8&yl=2026', { waitUntil: 'domcontentloaded' });
    
    fs.writeFileSync('debug_search9_aug.html', await page.content());
    
    await browser.close();
})();
