const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/main.php?cb=ms');
    await page.getByRole('link', { name: 'eRPH' }).click();
    await page.getByRole('link', { name: 'Buka Rekod' }).click();
    await page.waitForTimeout(2000);
    
    const options = await page.$$eval('#select_subject option', els => 
        els.map(el => ({ text: el.textContent, value: el.value }))
    );
    console.log(JSON.stringify(options, null, 2));
    
    await browser.close();
})();
