const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const page = await browser.newPage();
    console.log("Navigating to https://asiemodel.net ...");
    await page.goto('https://asiemodel.net', { waitUntil: 'domcontentloaded' });
    const content = await page.content();
    require('fs').writeFileSync('login_page2.html', content);
    console.log("URL after navigation: " + page.url());
    console.log("Saved login_page2.html");
    await browser.close();
})();
