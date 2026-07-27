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
    await page.locator('#select_subject').selectOption({ label: 'Matematik' });
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Cari' }).click();
    await page.waitForTimeout(2000);
    
    // Try to click Aug
    const tabLocator = page.locator('a:has-text("Aug")').first();
    if (await tabLocator.isVisible()) {
        console.log("Clicking Aug tab...");
        await tabLocator.click();
        await page.waitForTimeout(3000);
    }
    
    // Find MIW Link
    const startDate = "03-08-2026";
    console.log(`Looking for MIW with startDate: ${startDate}`);
    
    const miwLink = page.locator('tr').filter({ hasText: startDate }).getByRole('link', { name: 'MIW' }).first();
    
    try {
        await miwLink.waitFor({ state: 'visible', timeout: 5000 });
        console.log("MIW link IS VISIBLE!");
        await miwLink.click();
        console.log("Clicked MIW link successfully.");
        await page.waitForTimeout(2000);
        console.log("Current URL after click:", page.url());
    } catch (e) {
        console.log("Failed to find or click MIW link:", e.message);
    }
    
    await browser.close();
})();
