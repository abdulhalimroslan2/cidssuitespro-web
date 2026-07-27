const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

async function screenshotMIW() {
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("Logging in...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        
        await page.locator('input[type="email"], input[name="email"]').first().fill('Roslan2');
        await page.locator('input[type="password"], input[name="password"]').first().fill('@reeZ860');
        
        await Promise.all([
            page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
            page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login")').first().click()
        ]);
        
        console.log("Logged in. Navigating to eRPH...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        await page.getByRole('link', { name: 'eRPH' }).click();
        await page.getByRole('link', { name: 'Buka Rekod' }).click();
        await page.waitForTimeout(2000);
        
        // Select Sains
        await page.locator('#select_subject').selectOption('sg_science_math-science');
        await page.getByRole('button', { name: 'Cari' }).click();
        
        await page.waitForTimeout(2000);
        await page.locator('a:has-text("MIW")').first().click();
        await page.waitForTimeout(2000);
        
        // Buka popup MIW
        await page.locator('img[src="/images/database_table.png"]').first().click();
        await page.waitForTimeout(2000);
        
        console.log("Taking screenshot of MIW popup...");
        await page.screenshot({ path: 'miw_screenshot.png', fullPage: true });
        
        // Dump the DOM of the MIW popup
        const htmlDump = await page.evaluate(() => {
            return document.querySelector('.modal-content') ? document.querySelector('.modal-content').innerHTML : document.body.innerHTML;
        });
        
        fs.writeFileSync('miw_dump.html', htmlDump);
        console.log("Dump saved!");

    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
}

screenshotMIW();
