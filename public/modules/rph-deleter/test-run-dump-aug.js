const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: './auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'domcontentloaded' });
    
    const monthLink = await page.$(`div.month_pagination ul:nth-child(1) a[href*="ml=8"]`);
    if (monthLink) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            monthLink.click()
        ]);
        fs.writeFileSync('debug_search9_aug_real.html', await page.content());
    }
    
    await browser.close();
})();
