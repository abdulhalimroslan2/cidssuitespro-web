/**
 * playwright-launcher.js - STUB untuk Vercel/Web deployment
 * 
 * Playwright TIDAK boleh digunakan di Vercel Serverless Functions.
 * Fail ini adalah stub yang tidak crash supaya modul lain boleh import.
 * Fungsi sebenar RPH submission dilakukan oleh electron-mock.js di client-side.
 */

async function launchBrowser(options = {}) {
    throw new Error('Playwright tidak tersedia di Vercel Web App. Sila gunakan aplikasi desktop (EXE/DMG) untuk automasi RPH penuh.');
}

async function closeBrowser(browser) {
    // noop
}

module.exports = { launchBrowser, closeBrowser };
