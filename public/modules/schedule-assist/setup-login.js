const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

async function run() {
  console.log("Membuka pelayar (browser) untuk anda Log Masuk...");
  
  // Launch a visible browser so the user can login
  const browser = await launchBrowser({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Sila log masuk ke ASIE Model menggunakan akaun Google anda di tetingkap yang terbuka.");
  console.log("Selepas anda berjaya log masuk dan berada di muka surat utama (Dashboard), kembali ke sini dan tekan CTRL+C jika skrip tidak tertutup secara automatik.");

  await page.goto('https://asiemodel.net/');

  // Wait for the user to complete the login and reach the dashboard.
  // Assuming the dashboard URL contains 'dashboard' or 'home'. If not, we just wait for 60 seconds.
  try {
    await page.waitForURL('**/dashboard**', { timeout: 120000 });
    console.log("Log masuk dikesan!");
  } catch (e) {
    console.log("Masa menunggu tamat, atau URL berbeza. Menyimpan fail sesi (session)...");
  }

  // Save the authentication state (Cookies & LocalStorage)
  await context.storageState({ path: 'auth.json' });
  console.log("✅ Status Log Masuk (Cookies) telah berjaya disimpan di 'auth.json'!");
  console.log("Automasi seterusnya akan berjalan di latar belakang (tanpa membuka pelayar) dan menggunakan fail ini untuk melepasi Google Login.");

  await browser.close();
}

run();
