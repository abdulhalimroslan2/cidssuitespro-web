const { launchBrowser } = require('../playwright-launcher');
const path = require('path');

async function runTest() {
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const page = await browser.newPage();
    
    // Mock the electron API before loading the page
    await page.addInitScript(() => {
        window.electronAPI = {
            startAutomation: (payload) => {
                window._lastPayload = payload;
            },
            onScheduleExtracted: () => {},
            onAutomationLog: () => {},
            onAutomationDone: () => {}
        };
    });

    const fileUrl = 'file://' + path.join(__dirname, 'index.html');
    await page.goto(fileUrl);
    
    // Test 1: Check if "Lain-lain" input is hidden initially
    let isHidden = await page.evaluate(() => document.getElementById('bbmOtherInput').style.display === 'none');
    console.log("Test 1: 'Lain-lain' input hidden initially:", isHidden);

    // Test 2: Check "Lain-lain", ensure input shows up
    await page.click('#bbmOtherCb');
    let isVisible = await page.evaluate(() => document.getElementById('bbmOtherInput').style.display === 'inline-block');
    console.log("Test 2: 'Lain-lain' input visible after checking:", isVisible);

    // Test 3: Fill in "Lain-lain" and some other fields, click start, check payload
    await page.fill('#bbmOtherInput', 'Kad Imbasan');
    await page.click('input[name="rphLanguage"][value="English"]');
    await page.click('input[type="checkbox"][value="Buku Latihan"]');
    
    // Fill required fields so it doesn't fail
    await page.fill('#apiKeyInput', 'TEST_API_KEY');
    // We need to bypass the image upload check or mock it.
    await page.evaluate(() => {
        scheduleImageBase64 = "MOCK_BASE64";
    });

    await page.click('#startBtn');

    // Check payload
    const payload = await page.evaluate(() => window._lastPayload);
    console.log("Test 3 Payload Language:", payload?.language);
    console.log("Test 3 Payload BBM:", payload?.bbm);
    
    // Test 4: Reload page and check if LocalStorage restored the values
    await page.goto(fileUrl);
    
    const restoredLang = await page.evaluate(() => {
        const el = document.querySelector('input[name="rphLanguage"]:checked');
        return el ? el.value : null;
    });
    console.log("Test 4 Restored Language:", restoredLang);
    
    const restoredBbmChecked = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#bbmGroup input[type="checkbox"]:checked')).map(c => c.value);
    });
    console.log("Test 4 Restored Checkboxes:", restoredBbmChecked);
    
    const restoredOtherInputValue = await page.evaluate(() => document.getElementById('bbmOtherInput').value);
    console.log("Test 4 Restored Other Input:", restoredOtherInputValue);

    await browser.close();
}

runTest().catch(console.error);
