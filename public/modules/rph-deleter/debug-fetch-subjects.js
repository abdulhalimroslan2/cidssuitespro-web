const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');
const path = require('path');

(async () => {
    const os = require('os');
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
        console.log("Membuka ASIE Model...");
        await page.goto('https://asiemodel.net/v6/rph/rph_1_senarai.php');
        await page.waitForTimeout(2000);

        let subjectSelector = '#select_subject';
        if (!(await page.locator(subjectSelector).isVisible().catch(()=>false))) {
            subjectSelector = '#subjek_id';
        }

        const subjectOptions = await page.locator(`${subjectSelector} option`).evaluateAll(opts => 
            opts.map(o => ({ value: o.value, text: o.text.trim() }))
        );
        console.log("Subjek dalam dropdown:");
        console.log(JSON.stringify(subjectOptions, null, 2));

    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
})();
