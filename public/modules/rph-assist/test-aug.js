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
    
    // Select class 2 JABIR (value 201552) or index... let's just click Cari
    await page.locator('#select_classlevel').selectOption({ label: 'Tingkatan 2' });
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Cari' }).click();
    await page.waitForTimeout(2000);
    
    // Try to click Aug
    const tabLocator = page.locator('a:has-text("Aug")').first();
    if (await tabLocator.isVisible()) {
        console.log("Clicking Aug tab...");
        await tabLocator.click();
        await page.waitForTimeout(2000);
    } else {
        console.log("Aug tab not visible!");
    }
    
    // Dump dates in the table
    const dates = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('tr')).map(tr => tr.innerText).filter(t => t.includes('2026'));
    });
    console.log("TR innerText for Aug containing 2026:");
    console.log(dates.slice(0, 5));
    
    await browser.close();
})();
