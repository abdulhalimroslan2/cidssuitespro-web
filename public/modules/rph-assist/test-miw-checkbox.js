const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');
const path = require('path');

async function testCheckboxLogic() {
    const browser = await launchBrowser({ headless: false, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("Logging in...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        
        await page.locator('input[type="email"], input[name="email"], #email').first().fill('Roslan2');
        await page.locator('input[type="password"], input[name="password"], #password').first().fill('@reeZ860');
        
        await Promise.all([
            page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
            page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login")').first().click()
        ]);
        
        console.log("Logged in. Navigating to eRPH...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        
        const erphLink = page.getByRole('link', { name: 'eRPH' });
        if (await erphLink.isVisible()) {
            await erphLink.click();
        } else {
            console.log("eRPH link not found, trying fallback...");
            await page.goto('https://asiemodel.net/model/erph.php');
        }

        await page.getByRole('link', { name: 'Buka Rekod' }).click();
        await page.waitForTimeout(2000);
        
        // Select Math
        await page.locator('#select_subject').selectOption('sg_science_math-math');
        await page.getByRole('button', { name: 'Cari' }).click();
        await page.waitForTimeout(2000);
        
        await page.locator('a:has-text("MIW")').first().click();
        await page.waitForTimeout(2000);
        
        console.log("Clicking calendar icon...");
        await page.locator('img[src="/images/database_table.png"]').first().click();
        await page.waitForTimeout(2000);
        
        console.log("Looking for Matematik blocks...");
        const blocks = await page.locator('li.period.subject').all();
        console.log("Found", blocks.length, "total blocks.");
        
        let targetBlock = null;
        for (const block of blocks) {
            const text = await block.textContent();
            if (text.includes('1 BESTARI')) {
                targetBlock = block;
                break;
            }
        }
        
        if (!targetBlock) {
            console.log("Could not find '1 BESTARI' block. Taking screenshot.");
            await page.screenshot({ path: 'calendar.png' });
            return;
        }

        console.log("Clicking block...");
        await targetBlock.click({ force: true });
        
        console.log("Waiting for modal...");
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'modal_after_click.png' });
        
        console.log("Checking checkboxes...");
        const result = await page.evaluate(() => {
            const cbs = document.querySelectorAll('input[type="checkbox"]');
            return Array.from(cbs).map(cb => ({
                id: cb.id,
                className: cb.className,
                checked: cb.checked,
                parentText: cb.parentElement ? cb.parentElement.innerText : ''
            }));
        });
        
        console.log("Checkboxes found:", JSON.stringify(result, null, 2));

        if (result.length > 0) {
            console.log("Trying to untick the first checked one...");
            await page.evaluate(() => {
                const cbs = document.querySelectorAll('input[type="checkbox"]');
                for (let cb of cbs) {
                    if (cb.checked) {
                        cb.click();
                        break;
                    }
                }
            });
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'modal_after_untick.png' });
            
            console.log("Pressing Escape to close modal...");
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
            
            const isCiptaVisible = await page.getByRole('button', { name: 'Cipta RPH' }).isVisible();
            console.log("Is Cipta RPH button visible?", isCiptaVisible);
            
            // Wait to see if changes are saved. Reopen the block.
            console.log("Reopening block to see if changes persisted...");
            await targetBlock.click({ force: true });
            await page.waitForTimeout(2000);
            
            const result2 = await page.evaluate(() => {
                const cbs = document.querySelectorAll('input[type="checkbox"]');
                return Array.from(cbs).map(cb => ({
                    checked: cb.checked,
                    parentText: cb.parentElement ? cb.parentElement.innerText : ''
                }));
            });
            console.log("Checkboxes after reopen:", JSON.stringify(result2, null, 2));
        } else {
            console.log("NO CHECKBOXES FOUND IN MODAL!");
        }

    } catch (e) {
        console.error("Ralat:", e);
    } finally {
        await browser.close();
    }
}

testCheckboxLogic();
