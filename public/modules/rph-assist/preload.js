const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startAutomation: (payload) => ipcRenderer.send('start-automation', payload),
    onAutomationLog: (callback) => ipcRenderer.on('automation-log', (event, message) => callback(message)),
    onAutomationDone: (callback) => ipcRenderer.on('automation-done', () => callback()),
    onScheduleExtracted: (callback) => ipcRenderer.on('automation-schedule-extracted', (event, lessons) => callback(lessons)),
    fetchScheduleFromAsie: (credentials) => ipcRenderer.invoke('fetch-schedule-from-asie', { credentials }),
    encryptData: (text) => ipcRenderer.invoke('encrypt-data', text),
    decryptData: (base64) => ipcRenderer.invoke('decrypt-data', base64)
});
