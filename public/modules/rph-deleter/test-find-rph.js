const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'domcontentloaded' });
    
    // Change to August
    const monthLink = await page.$('div.month_pagination ul:nth-child(1) a[href*="ml=8"]');
    if (monthLink) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            monthLink.click()
        ]);
    }
    
    const rows = await page.locator('tr.miw_row').elementHandles();
    let texts = [];
    for (const row of rows) {
        texts.push(await row.innerText());
    }
    
    require('fs').writeFileSync('august_rows.json', JSON.stringify(texts, null, 2));
    console.log("Saved august_rows.json");
    await browser.close();
})();
