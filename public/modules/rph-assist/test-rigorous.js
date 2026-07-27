const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');
const path = require('path');

async function runRigorousTest() {
    console.log("Starting rigorous test...");
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("Navigating to ASIE Model...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        
        console.log("Attempting to log in with Roslan2...");
        const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="login"], input[placeholder="Login"], input[placeholder="Username"], input[placeholder*="E-mel"]').first();
        await emailInput.waitFor({ state: 'visible', timeout: 10000 });
        await emailInput.fill('Roslan2');
        
        const pwdInput = page.locator('input[type="password"], input[name="password"], input[placeholder="Password"]').first();
        await pwdInput.fill('@reeZ860');
        
        await page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Log Masuk")').first().click();
        
        console.log("Waiting for navigation after login...");
        await page.waitForNavigation({ timeout: 15000 }).catch(() => console.log("No navigation event, proceeding anyway..."));
        
        console.log("Checking if login was successful by looking for eRPH link...");
        const erphLink = page.getByRole('link', { name: 'eRPH' });
        
        if (await erphLink.isVisible({ timeout: 10000 })) {
            console.log("Login successful! eRPH link found.");
            await erphLink.click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: 'after-erph-click.png', fullPage: true });
            console.log("Checking 'Buka Rekod' link...");
            const bukaRekodLink = page.getByRole('link', { name: 'Buka Rekod' });
            if (await bukaRekodLink.isVisible({ timeout: 5000 })) {
                console.log("Successfully navigated to eRPH -> Buka Rekod!");
                await page.screenshot({ path: 'rigorous-test-success.png', fullPage: true });
                console.log("Screenshot saved as rigorous-test-success.png");
            } else {
                throw new Error("'Buka Rekod' link not found!");
            }
        } else {
            const currentUrl = page.url();
            console.log("Current URL:", currentUrl);
            await page.screenshot({ path: 'rigorous-test-failed.png', fullPage: true });
            throw new Error("Login failed or eRPH link not found. Check rigorous-test-failed.png");
        }
        
    } catch (error) {
        console.error("Rigorous test failed:", error);
    } finally {
        await browser.close();
        console.log("Test completed.");
    }
}

runRigorousTest();
