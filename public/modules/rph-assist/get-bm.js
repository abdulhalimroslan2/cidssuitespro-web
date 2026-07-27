const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

async function getBMId() {
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("Navigating to login page...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        await page.waitForTimeout(2000);
        
        const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="login"], input[placeholder="Login"], input[placeholder="Username"], input[placeholder*="E-mel"]').first();
        if (await emailInput.isVisible({ timeout: 5000 })) {
            console.log("Logging in...");
            await emailInput.fill('Roslan2');
            
            const pwdInput = page.locator('input[type="password"], input[name="password"], input[placeholder="Password"]').first();
            await pwdInput.fill('@reeZ860');
            
            await page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Log Masuk")').first().click();
            await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
            console.log("Logged in!");
            await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        }

        await page.getByRole('link', { name: 'eRPH' }).click();
        await page.getByRole('link', { name: 'Buka Rekod' }).click();
        await page.waitForTimeout(2000);
        
        const bmValue = await page.evaluate(() => {
            const select = document.querySelector('#select_subject');
            if (!select) return "Tiada dropdown select_subject!";
            const options = Array.from(select.options);
            const bmOption = options.find(o => o.text.includes('Melayu'));
            return bmOption ? bmOption.value : "Tiada pilihan Melayu dijumpai.";
        });
        
        console.log("=== KOD BM ===");
        console.log(bmValue);
        console.log("==============");
        
    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
}

getBMId();
