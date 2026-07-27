const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const page = await browser.newPage();
    console.log("Navigating to https://asiemodel.net/model/ ...");
    await page.goto('https://asiemodel.net/model/', { waitUntil: 'domcontentloaded' });
    const content = await page.content();
    require('fs').writeFileSync('login_page3.html', content);
    console.log("URL after navigation: " + page.url());
    console.log("Saved login_page3.html");
    await browser.close();
})();
