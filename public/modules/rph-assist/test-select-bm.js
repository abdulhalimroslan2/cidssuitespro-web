const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

async function testSelectBM() {
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
        
        const options = await page.evaluate(() => {
            const select = document.querySelector('#select_subject');
            if (!select) return [];
            return Array.from(select.options).map(o => ({ value: o.value, text: o.text }));
        });
        
        console.log("=== SEMUA PILIHAN SUBJEK ===");
        console.table(options);

        // Try selecting sg_language-bmelayu
        console.log("Mencuba memilih sg_language-bmelayu...");
        try {
            await page.locator('#select_subject').selectOption('sg_language-bmelayu');
            console.log("Berjaya memilih sg_language-bmelayu!");
        } catch(e) {
            console.error("Gagal memilih sg_language-bmelayu:", e.message);
        }

    } catch (e) {
        console.error("Ralat keseluruhan:", e);
    } finally {
        await browser.close();
    }
}

testSelectBM();
