const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    login: (username, password) => ipcRenderer.invoke('login', username, password),
    openRpt: (url) => ipcRenderer.invoke('open-rpt', url),
    onLoginStatus: (callback) => ipcRenderer.on('login-status', (event, data) => callback(data)),
    onRptList: (callback) => ipcRenderer.on('rpt-list', (event, data) => callback(data)),
    fillForm: (data) => ipcRenderer.invoke('fill-form', data),
    fillFormQueue: (dataArray) => ipcRenderer.invoke('fill-form-queue', dataArray),
    pageReloaded: () => ipcRenderer.invoke('page-reloaded')
});
