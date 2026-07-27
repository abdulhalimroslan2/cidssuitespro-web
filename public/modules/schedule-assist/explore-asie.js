const { launchBrowser } = require('../playwright-launcher');

async function exploreSubjects() {
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("Logging in...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        await page.locator('input[type="email"]').first().fill('Roslan2');
        await page.locator('input[type="password"]').first().fill('@reeZ860');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForNavigation();
        
        console.log("Pergi ke halaman Profil / Tetapan Subjek...");
        // Cuba cari pautan ke Profil atau Tetapan untuk lihat senarai penuh subjek
        // Kita akan dump semua pautan yang ada perkataan "Profil", "Subjek", "Tetapan"
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }));
        });
        
        console.log("Pautan yang dijumpai:");
        console.log(links.filter(l => l.text !== ''));
        
    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
}

exploreSubjects();
