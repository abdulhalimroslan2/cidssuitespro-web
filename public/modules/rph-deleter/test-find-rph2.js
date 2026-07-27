const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'domcontentloaded' });
    
    // Change to August
    const monthLink = await page.$('div.month_pagination ul:nth-child(1) a[href*="ml=8&"]');
    if (monthLink) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            monthLink.click()
        ]);
    }
    
    await page.screenshot({ path: 'august_page.png' });
    console.log("Saved august_page.png");
    await browser.close();
})();
