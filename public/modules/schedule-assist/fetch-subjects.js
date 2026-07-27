const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');
const path = require('path');

async function getSubjects() {
    const os = require('os');
    const platform = os.platform();
    const userDataPath = platform === 'win32' 
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'rph-automator')
        : (platform === 'darwin' 
            ? path.join(os.homedir(), 'Library', 'Application Support', 'rph-automator')
            : path.join(os.homedir(), '.config', 'rph-automator'));
    
    const authPath = path.join(userDataPath, 'auth.json');
    if (!fs.existsSync(authPath)) {
        console.error("auth.json tiada. Tidak boleh log masuk.");
        return;
    }

    const browser = await launchBrowser({ headless: false, channel: 'chrome' });
    const context = await browser.newContext({ storageState: authPath });
    const page = await context.newPage();

    try {
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        await page.waitForTimeout(2000);
        
        await page.getByRole('link', { name: 'eRPH' }).click();
        await page.getByRole('link', { name: 'Buka Rekod' }).click();
        await page.waitForTimeout(2000);
        
        const options = await page.evaluate(() => {
            const select = document.querySelector('#select_subject');
            if (!select) return [];
            return Array.from(select.options).map(o => ({ text: o.text, value: o.value }));
        });
        
        console.log("Senarai Subjek Ditemui:");
        console.log(JSON.stringify(options, null, 2));
        
    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
}

getSubjects();
