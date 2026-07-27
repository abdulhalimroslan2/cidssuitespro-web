const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const authPath = './auth.json';
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: authPath });
    const page = await context.newPage();
    await page.goto('https://asiemodel.net/model/miw9.php?action=openmiw&id=27646309');
    await page.waitForTimeout(3000);
    const count = await page.locator('ul.sub-menu a[href*="openRPH"]').count();
    console.log(`Found ${count} RPHs left.`);
    await browser.close();
})();
