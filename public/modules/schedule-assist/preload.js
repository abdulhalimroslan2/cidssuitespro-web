const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    extractScheduleAi: (payload) => ipcRenderer.invoke('extract-schedule-ai', payload),
    submitJadual: (payload) => ipcRenderer.send('submit-jadual', payload),
    onAutomationLog: (callback) => ipcRenderer.on('automation-log', (event, message) => callback(message)),
    onAutomationDone: (callback) => ipcRenderer.on('automation-done', () => callback()),
    fetchScheduleFromAsie: (credentials) => ipcRenderer.invoke('fetch-schedule-from-asie', { credentials }),
    encryptData: (text) => ipcRenderer.invoke('encrypt-data', text),
    decryptData: (base64) => ipcRenderer.invoke('decrypt-data', base64)
});
