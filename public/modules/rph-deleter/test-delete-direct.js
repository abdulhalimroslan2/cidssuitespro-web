const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

(async () => {
    const authPath = './auth.json';
    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: authPath });
    const page = await context.newPage();

    console.log("Navigating directly to deletion page for RPH 116948810 (or whatever ID)...");
    // We don't know the exact ID that still exists. Let's get the list of RPHs first.
    await page.goto('https://asiemodel.net/model/miw9.php?action=openmiw&id=27646309');
    await page.waitForTimeout(3000);
    
    // Find all RPH links
    const rphLinksLocator = page.locator('ul.sub-menu a[href*="openRPH"]');
    const count = await rphLinksLocator.count();
    console.log(`Found ${count} RPHs.`);
    
    if (count > 0) {
        let rphUrl = await rphLinksLocator.nth(0).getAttribute('href'); // e.g. miw9.php?action=openRPH&rph=116948810
        console.log(`First RPH URL: ${rphUrl}`);
        
        let deleteHref = rphUrl.replace('miw9.php?action=openRPH', 'rph.php?action=deleteRPH');
        let deleteUrl = 'https://asiemodel.net/model/' + deleteHref;
        console.log(`Navigating to delete URL: ${deleteUrl}`);
        
        await page.goto(deleteUrl);
        await page.waitForTimeout(2000);
        
        let sahHapusBtn = page.locator('input[value="Sah Hapus"]');
        if (await sahHapusBtn.isVisible()) {
            console.log("Found Sah Hapus button. Clicking...");
            await sahHapusBtn.click();
            await page.waitForTimeout(3000); // wait for server to process
            console.log("Clicked! RPH should be deleted.");
            
            // Check if it says successful or whatever
            const content = await page.content();
            if (content.includes('berjaya') || content.includes('window.close()')) {
                console.log("Looks like it was successful.");
            } else {
                console.log("Not sure if successful, saving screenshot.");
                await page.screenshot({ path: 'debug_after_delete.png' });
            }
        } else {
            console.log("Sah Hapus button not found! Screenshot saved.");
            await page.screenshot({ path: 'debug_no_sah_hapus.png' });
        }
    }

    await browser.close();
})();
