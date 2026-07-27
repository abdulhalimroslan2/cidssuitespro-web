const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startDeletion: (config) => ipcRenderer.send('start-deletion', config),
    clearAuth: () => ipcRenderer.send('clear-auth'),
    onLog: (callback) => ipcRenderer.on('deletion-log', (event, message) => callback(message)),
    onDone: (callback) => ipcRenderer.on('deletion-done', () => callback())
});
