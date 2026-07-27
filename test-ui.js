const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        console.log("Navigating to https://cidssuitespro.vercel.app...");
        await page.goto('https://cidssuitespro.vercel.app', { waitUntil: 'networkidle2' });

        console.log("Setting localStorage for CIDSGURU7158...");
        await page.evaluate(() => {
            localStorage.setItem('cids_username', 'CIDSGURU7158');
            localStorage.setItem('cids_password', '@reeZ8606441');
        });

        // Click Setting to trigger load
        await page.click('a[onclick*="Setting"]');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/Users/halimroslan/Desktop/CIDS SUITES PRO 2.0 Ubah Suai/cids-license-api/screenshot-setting.png' });
        console.log("Setting screenshot saved.");

        // Go to RPT Assist
        await page.click('a[onclick*="RPT Assist"]');
        await page.waitForTimeout(2000);
        // Click dropdown to show options
        await page.click('#rptDropdown');
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/Users/halimroslan/Desktop/CIDS SUITES PRO 2.0 Ubah Suai/cids-license-api/screenshot-rpt.png' });
        console.log("RPT Assist screenshot saved.");

        // Go to RPH Assist
        await page.click('a[onclick*="RPH Assist"]');
        await page.waitForTimeout(2000);
        // Click Muat Turun Jadual Waktu CIDS
        await page.click('#extractScheduleBtn');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/Users/halimroslan/Desktop/CIDS SUITES PRO 2.0 Ubah Suai/cids-license-api/screenshot-rph.png' });
        console.log("RPH Assist screenshot saved.");

        await browser.close();
        console.log("Test completed successfully!");
    } catch (e) {
        console.error("Error during Puppeteer test:", e);
        process.exit(1);
    }
})();
