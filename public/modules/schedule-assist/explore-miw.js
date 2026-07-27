const { launchBrowser } = require('../playwright-launcher');

async function exploreMIW() {
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("Logging in...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        
        await page.locator('input[type="email"], input[name="email"]').first().fill('Roslan2');
        await page.locator('input[type="password"], input[name="password"]').first().fill('@reeZ860');
        
        await Promise.all([
            page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
            page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login")').first().click()
        ]);
        
        console.log("Logged in. Navigating to eRPH...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        await page.getByRole('link', { name: 'eRPH' }).click();
        await page.getByRole('link', { name: 'Buka Rekod' }).click();
        await page.waitForTimeout(2000);
        
        // Select Sains atau Math
        await page.locator('#select_subject').selectOption('sg_science_math-math');
        await page.getByRole('button', { name: 'Cari' }).click();
        
        await page.waitForTimeout(2000);
        await page.locator('a:has-text("MIW")').first().click();
        await page.waitForTimeout(2000);
        
        // Buka popup MIW
        await page.locator('img[src="/images/database_table.png"]').first().click();
        await page.waitForTimeout(2000);
        
        console.log("Clicking subject in MIW...");
        await page.locator('li.period.subject').first().click({ force: true });
        await page.waitForTimeout(2000);
        
        // Take screenshot to see what opened
        await page.screenshot({ path: 'miw_subject_click.png', fullPage: true });
        
        // Dump the HTML
        const htmlDump = await page.evaluate(() => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
            let output = [];
            while(walker.nextNode()) {
                const node = walker.currentNode;
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text.length > 0) output.push("TEXT: " + text);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'INPUT' && node.type === 'checkbox') {
                        output.push(`CHECKBOX: id=${node.id} class=${node.className} checked=${node.checked}`);
                    }
                    if (node.tagName === 'BUTTON') {
                        output.push(`BUTTON: ${node.innerText}`);
                    }
                }
            }
            return output.join('\n');
        });
        
        const fs = require('fs');
        fs.writeFileSync('miw_subject_click_dump.txt', htmlDump);
        console.log("Dump saved!");

    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
}

exploreMIW();
