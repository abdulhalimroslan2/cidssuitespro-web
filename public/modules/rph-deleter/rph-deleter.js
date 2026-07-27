const { launchBrowser } = require('../playwright-launcher');
const path = require('path');
const fs = require('fs');

function getAuthFilePath() {
    try {
        const { app } = require('electron');
        if (app) return path.join(app.getPath('userData'), 'auth.json');
    } catch (e) {}
    return path.join(__dirname, 'auth.json');
}

async function setupLogin(username, password, logCallback) {
    const authFile = getAuthFilePath();
    const userFile = authFile + '.user';
    let lastUser = '';
    
    if (fs.existsSync(userFile)) {
        lastUser = fs.readFileSync(userFile, 'utf8');
    }
    
    if (fs.existsSync(authFile) && lastUser === username) {
        return;
    }
    
    if (fs.existsSync(authFile)) {
        fs.unlinkSync(authFile);
    }
    logCallback("Log masuk ke sistem ASIE Model...");
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        await page.goto('https://asiemodel.net/model/', { waitUntil: 'domcontentloaded' });
        await page.fill('input[name="username"]', username);
        await page.fill('input[name="password"]', password);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
            page.click('button[type="submit"]')
        ]);
        
        await context.storageState({ path: authFile });
        fs.writeFileSync(userFile, username);
        logCallback("Berjaya log masuk dan menyimpan sesi.");
    } catch (e) {
        throw new Error("Gagal log masuk. Sila periksa username & password. " + e.message);
    } finally {
        await browser.close();
    }
}

module.exports = {
    deleteRPH: async (username, password, miwDate, logCallback) => {
        const authFile = getAuthFilePath();
        
        await setupLogin(username, password, logCallback);
        
        let browser;
        try {
            browser = await launchBrowser({ headless: true });
            const context = await browser.newContext({ storageState: authFile });
            const page = await context.newPage();
            
            logCallback("Membuka ASIE Model...");
            await page.goto('https://asiemodel.net/model/main.php', { waitUntil: 'domcontentloaded' });
            
            logCallback("Masuk ke senarai RPH...");
            await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'domcontentloaded' });
            
            // Extract month and year from miwDate (e.g. "10-08-2026 — 14-08-2026")
            const dateParts = miwDate.split(' ')[0].split('-');
            const targetMonth = parseInt(dateParts[1], 10);
            const targetYear = parseInt(dateParts[2], 10);
            
            // 1. Check and change year if necessary
            const currentYearLink = await page.$('li.current_year a');
            if (currentYearLink) {
                const currentYear = parseInt(await currentYearLink.innerText(), 10);
                if (currentYear !== targetYear) {
                    logCallback(`Menukar ke tahun ${targetYear}...`);
                    const yearLink = await page.$(`div.month_pagination ul:nth-child(2) a[href*="yl=${targetYear}"]`);
                    if (yearLink) {
                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                            yearLink.click()
                        ]);
                    }
                }
            }
            
            // 2. Load the target month with MAX records (l=100)
            logCallback(`Menukar ke bulan ${targetMonth}...`);
            const monthLink = await page.$(`div.month_pagination ul:nth-child(1) a[href*="ml=${targetMonth}"]`);
            if (monthLink) {
                let href = await monthLink.getAttribute('href');
                if (href) {
                    // Force the limit to 100 so we can see all RPHs without pagination!
                    href = href.replace(/&l=\d+/, '&l=100');
                    // Handle html entities in href just in case
                    href = href.replace(/&amp;/g, '&');
                    
                    const currentUrl = page.url();
                    const baseUrl = currentUrl.split('?')[0];
                    await page.goto(`${baseUrl}${href}`, { waitUntil: 'domcontentloaded' });
                }
            }
            
            logCallback(`Mencari RPH untuk minggu bertarikh ${miwDate}...`);
            
            // Extract just the dates, ignoring the middle dash/spaces
            const startDate = miwDate.substring(0, 10);
            const endDate = miwDate.substring(miwDate.length - 10);
            
            // Wait a moment for any potential AJAX or rendering delays
            await page.waitForTimeout(3000);
            
            // Collect all RPH links for the specific date
            const rphUrls = [];
            const rows = await page.locator('tr.miw_row').elementHandles();
            
            for (const row of rows) {
                const rowText = await row.innerText();
                // Check if both dates exist in the row text, avoiding strict dash matching
                if (rowText.includes(startDate) && rowText.includes(endDate)) {
                    const rphLinks = await row.$$('a[href*="miw9.php?action=openRPH"]');
                    for (const link of rphLinks) {
                        const href = await link.getAttribute('href');
                        if (href) {
                            rphUrls.push(href);
                        }
                    }
                }
            }
            
            if (rphUrls.length === 0) {
                logCallback(`Tiada RPH dijumpai untuk minggu ${miwDate}.`);
                return;
            }
            
            logCallback(`Terjumpa ${rphUrls.length} pautan RPH untuk dihapuskan. Mula membuang...`);
            
            let successCount = 0;
            for (let i = 0; i < rphUrls.length; i++) {
                const deleteHref = rphUrls[i].replace('miw9.php?action=openRPH', 'rph.php?action=deleteRPH');
                const deleteUrl = 'https://asiemodel.net/model/' + deleteHref;
                
                logCallback(`-> Membuang RPH ${i+1}/${rphUrls.length}...`);
                await page.goto(deleteUrl, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(1500);

                const sahHapusBtn = page.locator('input[value="Sah Hapus"]');
                try {
                    await sahHapusBtn.waitFor({ state: 'visible', timeout: 3000 });
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                        sahHapusBtn.click()
                    ]);
                    logCallback(`✓ RPH ${i+1} berjaya dibuang.`);
                    successCount++;
                } catch (e) {
                    logCallback(`Amaran: RPH ${i+1} gagal dibuang (butang Sah Hapus tidak ditemui atau ralat).`);
                }
            }
            
            logCallback(`Selesai! ${successCount}/${rphUrls.length} RPH telah dibuang.`);
            
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
};
