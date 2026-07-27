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
    
    // Evaluate and dump the month tabs HTML
    const html = await page.evaluate(() => {
        // Find the container that holds the text 'JanFebMarAprMayJunJulAugSepOctNovDec'
        const container = document.querySelector('.pagination') || document.querySelector('.nav') || document.body;
        // Let's find any a tag with 'Aug'
        const aTags = Array.from(document.querySelectorAll('a')).filter(a => a.textContent.trim() === 'Aug');
        if (aTags.length > 0) {
            return aTags[0].parentElement.parentElement.outerHTML; // Try to get the ul/div wrapping it
        }
        return 'No Aug tab found';
    });
    
    fs.writeFileSync('test-tabs.html', html);
    console.log("Saved test-tabs.html");
    
    await browser.close();
})();
