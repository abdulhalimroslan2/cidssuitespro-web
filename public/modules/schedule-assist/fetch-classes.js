const { launchBrowser } = require('../playwright-launcher');
const path = require('path');
const fs = require('fs');

async function extractClasses(credentials = {}) {
    const os = require('os');
    const platform = os.platform();
    const userDataPath = platform === 'win32' 
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'rph-automator')
        : (platform === 'darwin' 
            ? path.join(os.homedir(), 'Library', 'Application Support', 'rph-automator')
            : path.join(os.homedir(), '.config', 'rph-automator'));
    const authPath = path.join(userDataPath, 'auth.json');
    
    console.log("Melancarkan penyemak imbas untuk mengekstrak kelas...");
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    let context;
    try {
        if (fs.existsSync(authPath) && !(credentials.username && credentials.password)) {
            context = await browser.newContext({ storageState: authPath });
        } else {
            context = await browser.newContext();
        }
    } catch (e) {
        context = await browser.newContext();
    }
    
    const page = await context.newPage();
    try {
        await page.goto('https://asiemodel.net/model/main.php?cb=ms', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);
        
        // --- AUTO-LOGIN SECTION ---
        if (credentials.username && credentials.password) {
            const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="login"], input[placeholder="Login"], input[placeholder="Username"], input[placeholder*="E-mel"]').first();
            if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                try {
                    await emailInput.fill(credentials.username);
                    const pwdInput = page.locator('input[type="password"], input[name="password"], input[placeholder="Password"]').first();
                    if (await pwdInput.isVisible()) {
                        await pwdInput.fill(credentials.password);
                        await Promise.all([
                            page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                            page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Log Masuk")').first().click()
                        ]);
                    } else {
                        await page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click();
                        await page.waitForTimeout(3000); 
                        if (await pwdInput.isVisible({ timeout: 5000 })) {
                            await pwdInput.fill(credentials.password);
                            await Promise.all([
                                page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                                page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click()
                            ]);
                        }
                    }
                    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                        throw new Error("Sila semak Username dan Password.");
                    }
                    await context.storageState({ path: authPath });
                } catch(e) {
                    return { success: false, error: "Log masuk gagal: " + e.message };
                }
            }
        }
        
        await page.goto('https://asiemodel.net/model/teachers9.php?action=waktumengajar', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const classes = await page.evaluate(() => {
            const classSelect = document.querySelector('#new_teaching_period');
            if (!classSelect) return [];
            return Array.from(classSelect.options)
                .map(opt => opt.text.trim())
                .filter(text => text !== '' && !text.toLowerCase().includes('pilih'));
        });
        
        return { success: true, classes: classes };
        
    } catch (e) {
        return { success: false, error: e.message };
    } finally {
        await browser.close();
    }
}

module.exports = { extractClasses };
