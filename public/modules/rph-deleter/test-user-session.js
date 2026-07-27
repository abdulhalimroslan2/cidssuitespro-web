const { launchBrowser } = require('../playwright-launcher');
const path = require('path');
const os = require('os');

(async () => {
    const platform = os.platform();
    const userDataPath = platform === 'win32' 
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'rph-automator')
        : (platform === 'darwin' 
            ? path.join(os.homedir(), 'Library', 'Application Support', 'rph-automator')
            : path.join(os.homedir(), '.config', 'rph-automator'));
    const authPath = path.join(userDataPath, 'auth.json');
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: authPath });
    const page = await context.newPage();
    
    await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'domcontentloaded' });
    
    const targetMonth = 8;
    const monthLink = await page.$(`div.month_pagination ul:nth-child(1) a[href*="ml=${targetMonth}&"]`);
    if (monthLink) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            monthLink.click()
        ]);
    }
    
    await page.waitForTimeout(3000);
    
    const imgPath = path.join(__dirname, 'user-august.png');
    await page.screenshot({ path: imgPath });
    
    const rows = await page.$$eval('tr.miw_row', rows => rows.map(r => r.innerText));
    require('fs').writeFileSync(path.join(__dirname, 'user-august-rows.json'), JSON.stringify(rows, null, 2));
    
    console.log("Saved user-august.png and user-august-rows.json");
    await browser.close();
})();
