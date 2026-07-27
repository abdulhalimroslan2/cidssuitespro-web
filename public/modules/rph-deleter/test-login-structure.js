const { launchBrowser } = require('../playwright-launcher');

(async () => {
    const browser = await launchBrowser({ headless: true });
    const page = await browser.newPage();
    console.log("Navigating to login.php...");
    await page.goto('https://asiemodel.net/login.php', { waitUntil: 'domcontentloaded' });
    const content = await page.content();
    require('fs').writeFileSync('login_page.html', content);
    console.log("Saved login_page.html");
    await browser.close();
})();
