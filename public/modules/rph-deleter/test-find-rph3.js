const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'domcontentloaded' });
    
    console.log("Current month selected: " + await page.$eval('div.month_pagination ul:nth-child(1) li.current_month', el => el.innerText));
    
    const monthLink = await page.$('div.month_pagination ul:nth-child(1) a[href*="ml=8&"]');
    if (monthLink) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            monthLink.click()
        ]);
        console.log("Clicked August");
    } else {
        console.log("Already on August or link not found");
    }
    
    const html = await page.content();
    require('fs').writeFileSync('august_page.html', html);
    console.log("Saved august_page.html");
    await browser.close();
})();
