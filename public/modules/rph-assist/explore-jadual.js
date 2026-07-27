const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

(async () => {
    const os = require('os');
    const path = require('path');
    const platform = os.platform();
    const userDataPath = platform === 'win32' 
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'rph-automator')
        : (platform === 'darwin' 
            ? path.join(os.homedir(), 'Library', 'Application Support', 'rph-automator')
            : path.join(os.homedir(), '.config', 'rph-automator'));
    const authPath = path.join(userDataPath, 'auth.json');
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ storageState: authPath });
    const page = await context.newPage();
    
    try {
        console.log("Navigating to ASIE...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms', { waitUntil: 'networkidle' });
        
        // Clicks eRPH
        console.log("Clicking eRPH...");
        await page.getByRole('link', { name: 'eRPH' }).click();
        await page.waitForTimeout(1000);
        
        // Find links
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.innerText.trim(),
                href: a.href
            }));
        });
        
        console.log("Links found under eRPH:");
        console.log(links.map(l => l.text));
        
        const jadualLink = links.find(l => l.text.toLowerCase().includes('jadual'));
        if (jadualLink) {
            console.log("Found Jadual Link:", jadualLink.href);
            await page.goto(jadualLink.href, { waitUntil: 'networkidle' });
            await page.waitForTimeout(1000);
            
            const html = await page.content();
            fs.writeFileSync('jadual_page.html', html);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
