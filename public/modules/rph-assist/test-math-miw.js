const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');
const path = require('path');

async function runTest() {
    const browser = await launchBrowser({ headless: false, channel: 'chrome' });
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
        
        // Select Math
        await page.locator('#select_subject').selectOption('sg_science_math-math');
        await page.getByRole('button', { name: 'Cari' }).click();
        
        await page.waitForTimeout(2000);
        await page.locator('a:has-text("MIW")').first().click();
        await page.waitForTimeout(2000);
        
        await page.locator('img[src="/images/database_table.png"]').first().click();
        await page.waitForTimeout(2000);
        
        console.log("Clicking Matematik subject block...");
        
        // Cek subject apa
        const subjectBlocks = await page.locator('li.period.subject').allTextContents();
        console.log("All subjects:", subjectBlocks);
        
        const mathBlocks = await page.locator('li.period.subject', { hasText: 'Matematik' }).all();
        if (mathBlocks.length > 0) {
            await mathBlocks[0].click({ force: true });
            console.log("Clicked! Waiting for modal...");
            await page.waitForTimeout(2000);
            
            // Take screenshot
            await page.screenshot({ path: 'modal_matematik.png' });
            
            // Try to find checkboxes
            const checkboxes = await page.evaluate(() => {
                const cbs = document.querySelectorAll('input[type="checkbox"]');
                return Array.from(cbs).map(cb => ({
                    id: cb.id,
                    checked: cb.checked,
                    parentText: cb.parentElement ? cb.parentElement.innerText : ''
                }));
            });
            console.log("Checkboxes found:", checkboxes);
            
            // Press Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
            
            const isVisible = await page.getByRole('button', { name: 'Cipta RPH' }).isVisible();
            console.log("Is Cipta RPH visible?", isVisible);
        } else {
            console.log("No Math blocks found!");
        }

    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
}

runTest();
