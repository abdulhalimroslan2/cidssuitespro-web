const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: './auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'domcontentloaded' });
    const rows = await page.locator('tr.miw_row').elementHandles();
    let miwUrl = null;
    
    for (const row of rows) {
        const text = await row.innerText();
        if (text.includes("13-07-2026 — 17-07-2026")) {
            const miwLink = await row.$('a[href*="miw9.php?action=openmiw"]');
            if (miwLink) {
                miwUrl = 'https://asiemodel.net/model/' + await miwLink.getAttribute('href');
            }
            break;
        }
    }
    
    if (miwUrl) {
        console.log("Going to", miwUrl);
        await page.goto(miwUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000); // wait for content to load
        fs.writeFileSync('debug_miw_opened.html', await page.content());
    } else {
        console.log("Not found");
    }
    
    await browser.close();
    console.log("Done");
})();
