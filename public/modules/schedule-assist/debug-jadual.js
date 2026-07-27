const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

async function debugJadualPage() {
    console.log("Memulakan sambungan ke ASIE Model...");
    const browser = await launchBrowser({ headless: true, channel: 'chrome' }); 
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('https://asiemodel.net/model/main.php?cb=ms', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="login"], input[placeholder="Login"], input[placeholder="Username"], input[placeholder*="E-mel"]').first();
        await emailInput.fill('Roslan2');
        
        const pwdInput = page.locator('input[type="password"], input[name="password"], input[placeholder="Password"]').first();
        if (await pwdInput.isVisible()) {
            await pwdInput.fill('@reeZ860');
            await Promise.all([
                page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Log Masuk")').first().click()
            ]);
        } else {
            await page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click();
            await page.waitForTimeout(3000); 
            await pwdInput.fill('@reeZ860');
            await Promise.all([
                page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click()
            ]);
        }
        console.log("Log Masuk Selesai.");
        
        await page.goto('https://asiemodel.net/model/teachers9.php?action=waktumengajar', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000); 

        const html = await page.content();
        fs.writeFileSync('debug_jadual_page.html', html);
        console.log("Berjaya menyimpan halaman ke debug_jadual_page.html");
    } catch (error) {
        console.error("Ralat:", error.message);
    } finally {
        await browser.close();
    }
}

debugJadualPage();
