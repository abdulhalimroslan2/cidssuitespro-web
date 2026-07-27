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
    console.log("Going to miw9.php?action=miw...");
    await page.goto('https://asiemodel.net/model/miw9.php?action=miw');
    await page.waitForTimeout(3000);
    
    const content = await page.content();
    fs.writeFileSync('test-erph.html', content);
    console.log("Saved test-erph.html");
    
    // Try to find the MIW link
    const links = await page.evaluate(() => {
        const trs = Array.from(document.querySelectorAll('tr'));
        return trs.map(tr => tr.textContent.trim().replace(/\s+/g, ' ')).filter(text => text.includes('MIW'));
    });
    
    console.log("Found TRs with MIW:", links);
    await browser.close();
})();
