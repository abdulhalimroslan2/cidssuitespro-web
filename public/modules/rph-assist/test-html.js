const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

(async () => {
    const authPath = '/Users/halimroslan/Library/Application Support/rph-automator/auth.json';
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ 
        storageState: authPath,
        viewport: { width: 1280, height: 720 } 
    });
    
    const page = await context.newPage();
    console.log("Going to main.php...");
    await page.goto('https://asiemodel.net/model/main.php?cb=ms');
    await page.getByRole('link', { name: 'eRPH' }).click();
    await page.getByRole('link', { name: 'Buka Rekod' }).click();
    await page.waitForTimeout(1500);
    
    await page.locator('#select_classlevel').selectOption({ index: 2 }); // pick something
    await page.waitForTimeout(1000);
    await page.locator('#select_subject').selectOption({ index: 1 }); // pick something
    await page.waitForTimeout(1000);
    
    await page.getByRole('button', { name: 'Cari' }).click();
    await page.waitForTimeout(3000);
    
    const html = await page.evaluate(() => {
        const trs = Array.from(document.querySelectorAll('tr'));
        const target = trs.find(tr => tr.textContent.includes('MIW') && tr.textContent.includes('FARABI'));
        return target ? target.outerHTML : 'No TR found';
    });
    
    fs.writeFileSync('test-row.html', html);
    console.log("Saved test-row.html");
    
    await browser.close();
})();
