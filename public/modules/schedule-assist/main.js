const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const { runAutomation } = require('./index.js');
const { extractSchedule } = require('./fetch-schedule.js');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');

    let isAutomationRunning = false;

    ipcMain.handle('extract-schedule-ai', async (event, payload) => {
        if (isAutomationRunning) {
            event.sender.send('automation-log', 'Amaran: Proses automasi sedang berjalan.');
            return { success: false, error: 'Proses sedang berjalan' };
        }
        
        isAutomationRunning = true;
        const { apiKey, imageBase64 } = payload || {};
        try {
            event.sender.send('automation-log', 'Menganalisis jadual waktu menggunakan AI...');
            const { analyzeScheduleImage } = require('./index.js');
            const lessons = await analyzeScheduleImage(apiKey, imageBase64);
            return { success: true, lessons };
        } catch (error) {
            event.sender.send('automation-log', 'ERROR AI: ' + error.message);
            return { success: false, error: error.message };
        } finally {
            isAutomationRunning = false;
        }
    });

    ipcMain.on('submit-jadual', async (event, payload) => {
        if (isAutomationRunning) {
            event.reply('automation-log', 'Amaran: Proses automasi sedang berjalan.');
            return;
        }
        
        isAutomationRunning = true;
        const { credentials, lessons } = payload || {};
        try {
            const { submitJadual } = require('./jadual-importer.js');
            event.reply('automation-log', 'Mula menghantar jadual ke ASIE Model...');
            
            // Redirect console.log and console.error to UI temporarily
            const originalConsoleLog = console.log;
            const originalConsoleError = console.error;
            console.log = (...args) => { originalConsoleLog(...args); event.reply('automation-log', args.join(' ')); };
            console.error = (...args) => { originalConsoleError(...args); event.reply('automation-log', 'ERROR: ' + args.join(' ')); };
            
            await submitJadual(lessons, credentials);
            
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
            
            event.reply('automation-done');
        } catch (error) {
            event.reply('automation-log', 'ERROR: ' + error.message);
            event.reply('automation-done');
        } finally {
            isAutomationRunning = false;
        }
    });

    let isExtracting = false;

    ipcMain.handle('fetch-schedule-from-asie', async (event, payload) => {
        if (isExtracting) {
            return { success: false, error: 'Proses pengekstrakan sedang berjalan. Sila tunggu.' };
        }
        
        isExtracting = true;
        try {
            const credentials = payload?.credentials || {};
            const result = await extractSchedule(credentials);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            isExtracting = false;
        }
    });

    // Kriptografi Selamat (safeStorage)
    ipcMain.handle('encrypt-data', async (event, text) => {
        if (!text) return '';
        try {
            if (safeStorage.isEncryptionAvailable()) {
                const buffer = safeStorage.encryptString(text);
                return buffer.toString('base64');
            }
            return text; // Fallback jika OS tak support
        } catch (e) {
            console.error('Encryption failed:', e);
            return text;
        }
    });

    ipcMain.handle('decrypt-data', async (event, encryptedBase64) => {
        if (!encryptedBase64) return '';
        try {
            if (safeStorage.isEncryptionAvailable()) {
                const buffer = Buffer.from(encryptedBase64, 'base64');
                return safeStorage.decryptString(buffer);
            }
            return encryptedBase64;
        } catch (e) {
            console.error('Decryption failed:', e);
            return encryptedBase64; // Fallback jika bukan encrypted
        }
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
