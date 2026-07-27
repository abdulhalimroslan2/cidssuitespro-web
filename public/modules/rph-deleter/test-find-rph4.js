const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'domcontentloaded' });
    
    const monthLink = await page.$('div.month_pagination ul:nth-child(1) a[href*="ml=8&"]');
    if (monthLink) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            monthLink.click()
        ]);
    }
    
    const links = await page.$$eval('div.month_pagination ul:nth-child(1) li', elements => elements.map(e => e.outerHTML));
    require('fs').writeFileSync('month_links_after.json', JSON.stringify(links, null, 2));
    console.log("Saved month_links_after.json");
    await browser.close();
})();
