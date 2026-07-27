const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

async function screenshotRPH() {
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("Logging in...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        
        await page.locator('input[type="email"], input[name="email"], input[name="username"]').first().fill('Roslan2');
        await page.locator('input[type="password"], input[name="password"]').first().fill('@reeZ860');
        
        await page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Log Masuk")').first().click();
        await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
        
        console.log("Logged in. Navigating to eRPH...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        await page.getByRole('link', { name: 'eRPH' }).click();
        await page.getByRole('link', { name: 'Buka Rekod' }).click();
        await page.waitForTimeout(2000);
        
        // Pilih subjek Sains untuk melihat strukturnya
        await page.locator('#select_subject').selectOption('sg_science_math-science');
        await page.getByRole('button', { name: 'Cari' }).click();
        
        await page.waitForTimeout(2000);
        await page.locator('a:has-text("MIW")').first().click();
        await page.waitForTimeout(2000);
        
        await page.locator('img[src="/images/database_table.png"]').first().click();
        await page.waitForTimeout(1000);
        
        await page.locator('li.period.subject').first().click({ force: true });
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        
        console.log("Clicking Sunting RPH...");
        
        if (await page.getByRole('button', { name: 'Cipta RPH' }).isVisible()) {
            await Promise.all([
                page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                page.getByRole('button', { name: 'Cipta RPH' }).click()
            ]);
        } else if (await page.getByRole('button', { name: 'Sunting RPH' }).isVisible()) {
            await Promise.all([
                page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                page.getByRole('button', { name: 'Sunting RPH' }).click()
            ]);
        }
        
        console.log("Waiting for iframe...");
        await page.waitForTimeout(5000);
        
        console.log("Taking screenshot...");
        await page.screenshot({ path: 'rph_screenshot.png', fullPage: true });
        
        // Juga dump DOM text berdekatan "Standard Pembelajaran"
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
                    if (node.tagName !== 'TR' && node.tagName !== 'TBODY' && node.tagName !== 'TABLE' && node.tagName !== 'DIV') {
                       output.push(`ELEMENT: <${node.tagName.toLowerCase()} id="${node.id}" class="${node.className}" type="${node.type||''}">`);
                    }
                    if (node.tagName === 'INPUT' && node.type === 'checkbox') {
                        output.push(`CHECKBOX: checked=${node.checked}`);
                    }
                }
            }
            return output.join('\n');
        });
        
        console.log("HTML DUMP:");
        console.log(htmlDump);
        console.log("Screenshot saved!");

    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
}

screenshotRPH();
