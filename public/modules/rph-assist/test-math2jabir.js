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
    
    // Select class 2 JABIR
    const classOptions = await page.locator('#select_classlevel option').evaluateAll(opts => 
        opts.map(o => ({ value: o.value, text: o.text.trim() }))
    );
    const classMatch = classOptions.find(o => o.text.includes('2 JABIR'));
    if (classMatch) {
        console.log("Found class:", classMatch.text);
        await page.locator('#select_classlevel').selectOption(classMatch.value);
    } else {
        console.log("Class 2 JABIR not found!");
    }
    
    await page.waitForTimeout(1000);
    
    // Select subject Matematik
    const subjOptions = await page.locator('#select_subject option').evaluateAll(opts => 
        opts.map(o => ({ value: o.value, text: o.text.trim() }))
    );
    const subjMatch = subjOptions.find(o => o.text.includes('Matematik'));
    if (subjMatch) {
        console.log("Found subject:", subjMatch.text);
        await page.locator('#select_subject').selectOption(subjMatch.value);
    } else {
        console.log("Subject Matematik not found!");
    }
    
    await page.waitForTimeout(1000);
    
    await page.getByRole('button', { name: 'Cari' }).click();
    console.log("Clicked Cari, waiting...");
    await page.waitForTimeout(3000);
    
    // Click Aug tab
    console.log("Clicking Aug tab...");
    const tabLink = page.locator('.nav-link.month-tab', { hasText: 'Aug' });
    if (await tabLink.isVisible()) {
        await tabLink.click();
        await page.waitForTimeout(1500);
    } else {
        console.log("Aug tab not visible!");
    }
    
    // Dump tr dates
    const dates = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('tr')).map(tr => {
            const div = tr.querySelector('.miw_link.miw_rph');
            return div ? div.textContent.trim() : null;
        }).filter(Boolean);
    });
    console.log("Dates found:", dates);
    
    await browser.close();
})();
