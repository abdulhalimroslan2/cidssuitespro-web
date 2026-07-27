const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

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
        await tabLocator.click();
        await page.waitForTimeout(2000);
    }
    
    // Dump dates in the table
    const html = await page.evaluate(() => {
        const tr = Array.from(document.querySelectorAll('tr')).find(t => t.innerText.includes('03-08-2026 — 07-08-2026'));
        return tr ? tr.outerHTML : 'TR not found';
    });
    
    fs.writeFileSync('test-aug-tr.html', html);
    console.log("Saved test-aug-tr.html");
    
    await browser.close();
})();
