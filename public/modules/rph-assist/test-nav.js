const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const authPath = '/Users/halimroslan/Library/Application Support/rph-automator/auth.json';
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ storageState: authPath });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/main.php?cb=ms');
    await page.getByRole('link', { name: 'eRPH' }).click();
    await page.getByRole('link', { name: 'Buka Rekod' }).click();
    await page.waitForTimeout(1500);
    
    await page.locator('#select_classlevel').selectOption({ label: 'Tingkatan 2' });
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Cari' }).click();
    await page.waitForTimeout(2000);
    
    // Try to click Aug
    const tabLocator = page.locator('a:has-text("Aug")').first();
    if (await tabLocator.isVisible()) {
        console.log("Clicking Aug tab and waiting for navigation...");
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
            tabLocator.click()
        ]);
        console.log("Navigation finished!");
    }
    
    await browser.close();
})();
