const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

(async () => {
    const browser = await launchBrowser({ headless: true }); 
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();

    try {
        console.log("Membuka ASIE Model...");
        await page.goto('https://asiemodel.net/v6/v6_index.php', { waitUntil: 'networkidle' });

        console.log("Navigasi ke RPH...");
        await page.goto('https://asiemodel.net/v6/rph/rph_1_senarai.php');
        
        console.log("Memilih Subjek...");
        await page.locator('#subjek_id').selectOption("sg_science_math-mathematics");
        await page.waitForTimeout(2000);
        
        console.log("Memilih Kelas...");
        await page.locator('#kelas_id').selectOption("cg_secondary-form4");
        await page.waitForTimeout(2000);

        console.log("Klik Cari...");
        await page.getByRole('button', { name: 'CARI' }).click();
        await page.waitForTimeout(3000);

        console.log("Mencari MIW...");
        const miwLink = page.locator('tr').filter({ hasText: '06-07-2026 — 10-07-2026' }).getByRole('link', { name: 'MIW' }).first();
        
        if (await miwLink.isVisible()) {
            await miwLink.click();
            await page.waitForTimeout(5000); // Tunggu MIW page load sepenuhnya
            
            console.log("Menyimpan screenshot...");
            await page.screenshot({ path: 'miw-page.png', fullPage: true });
            
            const html = await page.content();
            fs.writeFileSync('miw-page.html', html);
            console.log("Berjaya simpan miw-page.html dan miw-page.png");
        } else {
            console.log("MIW link tak dijumpai.");
        }
    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
})();
