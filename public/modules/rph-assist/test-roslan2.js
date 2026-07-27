const { launchBrowser } = require('../playwright-launcher');
async function test() {
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://asiemodel.net/model/main.php?cb=ms');
    await page.waitForTimeout(1000);
    const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="login"], input[placeholder="Login"], input[placeholder="Username"], input[placeholder*="E-mel"]').first();
    await emailInput.fill('Roslan2');
    const pwdInput = page.locator('input[type="password"], input[name="password"], input[placeholder="Password"]').first();
    await pwdInput.fill('@reeZ860');
    await page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Log Masuk")').first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'login-result.png' });
    await browser.close();
}
test();
