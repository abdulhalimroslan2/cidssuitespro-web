const { chromium } = require('playwright-core');
const chromiumSparticuz = require('@sparticuz/chromium');
const path = require('path');
const fs = require('fs');

async function launchBrowser(options = {}) {
    let executablePath;
    let browserOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        ...options
    };

    if (process.env.VERCEL || process.env.AWS_REGION) {
        // We are on Vercel or AWS Lambda
        console.log("Using Sparticuz Chromium for Vercel...");
        executablePath = await chromiumSparticuz.executablePath();
        browserOptions.args = chromiumSparticuz.args;
        browserOptions.headless = chromiumSparticuz.headless;
    } else {
        // We are on local machine or standard server, use system chromium or fallback
        console.log("Using local system Chromium...");
        // Fallback for macOS standard Chrome installation if local testing
        const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        if (fs.existsSync(macChrome)) {
            executablePath = macChrome;
        } else {
            throw new Error("Local chromium executable not found for local testing.");
        }
    }

    if (executablePath) {
        browserOptions.executablePath = executablePath;
    }

    if (browserOptions.channel === 'chrome') {
        delete browserOptions.channel;
    }

    return await chromium.launch(browserOptions);
}

module.exports = { launchBrowser };
