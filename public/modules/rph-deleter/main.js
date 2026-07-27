const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { runDeletion } = require('./index.js');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 500,
        height: 650,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');

    ipcMain.on('start-deletion', async (event, config) => {
        try {
            await runDeletion(config, (logMessage) => {
                event.reply('deletion-log', logMessage);
            });
            event.reply('deletion-done');
        } catch (error) {
            event.reply('deletion-log', 'RALAT: ' + error.message);
            event.reply('deletion-done');
        }
    });

    ipcMain.on('clear-auth', (event) => {
        const fs = require('fs');
        const authPath = path.join(app.getPath('userData'), 'auth.json');
        if (fs.existsSync(authPath)) {
            fs.unlinkSync(authPath);
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
