const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'domcontentloaded' });
    const links = await page.$$eval('div.month_pagination ul:nth-child(2) li', elements => elements.map(e => e.outerHTML));
    require('fs').writeFileSync('year_links.json', JSON.stringify(links, null, 2));
    console.log("Saved year_links.json");
    await browser.close();
})();
