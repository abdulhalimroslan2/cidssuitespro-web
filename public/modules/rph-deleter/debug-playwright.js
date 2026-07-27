const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

(async () => {
    const browser = await launchBrowser({ headless: true }); 
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/main.php?cb=ms');
    await page.getByRole('link', { name: 'eRPH' }).click();
    await page.getByRole('link', { name: 'Buka Rekod' }).click();
    
    await page.locator('#select_classlevel').selectOption('cg_secondary-form4');
    await page.locator('#select_subject').selectOption('sg_science_math-mathematics');
    await page.getByRole('button', { name: 'Cari' }).click();
    
    await page.locator('tr').filter({ hasText: '06-07-2026 — 10-07-2026' }).getByRole('link', { name: 'MIW' }).first().click();
    
    await page.waitForTimeout(1500);
    await page.getByRole('img').nth(1).click();
    await page.waitForTimeout(1500); // Tunggu modal

    const html = await page.content();
    fs.writeFileSync('debug_dom.html', html);
    console.log("HTML disimpan ke debug_dom.html");
    
    await browser.close();
})();
