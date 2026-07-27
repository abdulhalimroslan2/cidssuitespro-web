const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function launchBrowser(options = {}) {
    let executablePath;
    
    // Auto-detect bundled browser if packaged
    try {
        const { app: electronApp } = require('electron');
        if (electronApp && electronApp.isPackaged) {
            const resourcesPath = process.resourcesPath;
            process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(resourcesPath, 'playwright-browsers');
            
            if (os.platform() === 'win32') {
                if (options.headless !== false) {
                    const execPath = path.join(resourcesPath, 'playwright-browsers', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
                    if (fs.existsSync(execPath)) executablePath = execPath;
                } else {
                    const execPath = path.join(resourcesPath, 'playwright-browsers', 'chromium-1228', 'chrome-win64', 'chrome.exe');
                    if (fs.existsSync(execPath)) executablePath = execPath;
                }
            } else if (os.platform() === 'darwin') {
                if (options.headless !== false) {
                    const execPathIntel = path.join(resourcesPath, 'playwright-browsers', 'chromium_headless_shell-1228', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell');
                    const execPathSilicon = path.join(resourcesPath, 'playwright-browsers', 'chromium_headless_shell-1228', 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
                    if (fs.existsSync(execPathIntel)) executablePath = execPathIntel;
                    else if (fs.existsSync(execPathSilicon)) executablePath = execPathSilicon;
                } else {
                    const execPathIntel = path.join(resourcesPath, 'playwright-browsers', 'chromium-1228', 'chrome-mac-x64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
                    const execPathSilicon = path.join(resourcesPath, 'playwright-browsers', 'chromium-1228', 'chrome-mac-arm64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
                    if (fs.existsSync(execPathIntel)) executablePath = execPathIntel;
                    else if (fs.existsSync(execPathSilicon)) executablePath = execPathSilicon;
                }
            }
        }
    } catch (e) {
        // Ignore errors if electron is not available
    }
    
    // Default options
    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        ...options
    };
    
    // Remove channel: 'chrome' to ensure it uses the bundled chromium instead of requiring local Google Chrome
    if (launchOptions.channel === 'chrome') {
        delete launchOptions.channel;
    }
    
    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }
    
    return await chromium.launch(launchOptions);
}

module.exports = { launchBrowser };
