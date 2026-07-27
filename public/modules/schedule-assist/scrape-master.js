const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

async function scrapeMasterSubjects() {
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("Logging in...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        await page.locator('input[type="email"]').first().fill('Roslan2');
        await page.locator('input[type="password"]').first().fill('@reeZ860');
        await page.locator('button[type="submit"]').first().click();
        
        await page.waitForTimeout(3000);
        
        console.log("Mencari pautan tetapan / profil / subjek...");
        
        const allLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.innerText.trim(),
                href: a.href
            })).filter(l => l.text !== '' && l.href !== '');
        });
        
        console.log("Semua Pautan Menarik:");
        for (const link of allLinks) {
            if (link.text.toLowerCase().includes('profil') || link.text.toLowerCase().includes('tetapan') || link.text.toLowerCase().includes('subjek') || link.text.toLowerCase().includes('kelas')) {
                console.log(`- ${link.text}: ${link.href}`);
            }
        }
        
        // Coba pergi ke href profil jika ada
        const profilLink = allLinks.find(l => l.text.toLowerCase().includes('profil'));
        if (profilLink) {
            console.log(`Pergi ke Profil: ${profilLink.href}`);
            await page.goto(profilLink.href);
            await page.waitForTimeout(3000);
            
            // Tengok html form
            const selects = await page.evaluate(() => {
                const results = [];
                document.querySelectorAll('select').forEach(s => {
                    results.push({
                        id: s.id,
                        name: s.name,
                        optionsCount: s.options.length,
                        sampleOptions: Array.from(s.options).slice(0, 5).map(o => o.text)
                    });
                });
                return results;
            });
            console.log("Dropdown di Profil:", selects);
        }

    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
}

scrapeMasterSubjects();
