const { launchBrowser } = require('../playwright-launcher');

async function testCheckboxes() {
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("Logging in...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        await page.locator('input[type="email"]').first().fill('Roslan2');
        await page.locator('input[type="password"]').first().fill('@reeZ860');
        await page.locator('button[type="submit"]').first().click();
        
        await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
        console.log("Logged in!");
        
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        await page.getByRole('link', { name: 'eRPH' }).click();
        await page.getByRole('link', { name: 'Buka Rekod' }).click();
        await page.waitForTimeout(2000);
        
        // Pilih subjek Sains untuk melihat strukturnya (sebab screenshot sains takda checkbox)
        // Atau pilih Bahasa Melayu
        // Mari kita cuba Bahasa Melayu dahulu
        await page.locator('#select_subject').selectOption('sg_language-bmelayu');
        await page.getByRole('button', { name: 'Cari' }).click();
        
        // Klik pautan MIW pertama
        await page.locator('a:has-text("MIW")').first().click();
        await page.waitForTimeout(2000);
        
        // Buka popup
        await page.locator('img[src="/images/database_table.png"]').first().click();
        await page.waitForTimeout(1000);
        
        // Klik subjek pertama dalam senarai (Sesi 1)
        await page.locator('li.period.subject').first().click({ force: true });
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        
        // Klik Cipta RPH atau Sunting RPH
        if (await page.getByRole('button', { name: 'Cipta RPH' }).isVisible()) {
            await Promise.all([
                page.waitForNavigation({ timeout: 10000 }),
                page.getByRole('button', { name: 'Cipta RPH' }).click()
            ]);
        } else if (await page.getByRole('button', { name: 'Sunting RPH' }).isVisible()) {
            await Promise.all([
                page.waitForNavigation({ timeout: 10000 }),
                page.getByRole('button', { name: 'Sunting RPH' }).click()
            ]);
        }
        
        await page.waitForTimeout(3000);
        
        // Dump the HTML structure near "Standard Pembelajaran"
        const htmlDump = await page.evaluate(() => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
            
            let inStandardSection = false;
            let output = [];
            
            while(walker.nextNode()) {
                const node = walker.currentNode;
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim().toUpperCase();
                    if (text.startsWith('STANDARD PEMBELAJARAN')) {
                        inStandardSection = true;
                        output.push("--- BEGIN STANDARD PEMBELAJARAN ---");
                    } else if (inStandardSection && text.length > 2) {
                        if (text.startsWith('OBJEKTIF') || text.startsWith('KRITERIA') || text.startsWith('AKTIVITI')) {
                            inStandardSection = false;
                            output.push("--- END STANDARD PEMBELAJARAN ---");
                            break;
                        } else {
                            output.push("TEXT: " + text);
                        }
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE && inStandardSection) {
                    output.push(`ELEMENT: <${node.tagName.toLowerCase()} id="${node.id}" class="${node.className}" type="${node.type}">`);
                    if (node.tagName === 'INPUT' && node.type === 'checkbox') {
                        output.push(`CHECKBOX: checked=${node.checked}`);
                    }
                }
            }
            return output.join('\n');
        });
        
        console.log("HTML DUMP (BAHASA MELAYU):");
        console.log(htmlDump);

    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
}

testCheckboxes();
