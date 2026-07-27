const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');

let mainWindow;
let loginView;
let extPopupView;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#f1f5f9'
    });

    // Load original Chrome extension
    const extensionPath = path.join(__dirname, '../CIDS_RPT_AI_Assist (2)');
    try {
        await session.defaultSession.loadExtension(extensionPath, { allowFileAccess: true });
        console.log("Extension loaded successfully.");
    } catch (e) {
        console.error("Failed to load extension:", e);
    }

    mainWindow.loadFile('index.html');
    
    // Create a hidden BrowserView for logging into asiemodel.net
    loginView = new BrowserView();
    mainWindow.setBrowserView(loginView);
    loginView.setBounds({ x: 0, y: 0, width: 0, height: 0 }); // Hidden    // Load the correct CIDS Model login page
    loginView.webContents.loadURL('https://asiemodel.net/model/index.php');
    
    loginView.webContents.on('did-finish-load', async () => {
        const url = loginView.webContents.getURL();
        console.log("Current URL:", url);
        
        if (isProcessingQueue) {
            console.log("RPT Page finished loading. Proceeding with the next item in queue...");
            setTimeout(() => {
                processNextInQueue();
            }, 3000); // give 3 seconds for UI to settle
        }
        
        // If we landed on main9.php or main.php, login was successful
        if (url.includes('main9.php') || url.includes('main.php')) {
            mainWindow.webContents.send('login-status', { success: true });
            
            // Navigate directly to the RPT search page
            console.log("Navigating to RPT search page...");
            setTimeout(() => {
                loginView.webContents.loadURL('https://asiemodel.net/model/search9.php?action=search_yearly');
            }, 1000);
        }
        
        // Once we are on the search9.php page, extract the RPTs
        if (url.includes('search9.php') && !url.includes('redirect=')) {
            // Inject a script that polls for RPT links
            loginView.webContents.executeJavaScript(`
                (function() {
                    function findRPTs() {
                        let links = Array.from(document.querySelectorAll('.row_content table tbody tr td a[href^="rpt9.php?action=create_rpt"]'));
                        
                        if (links.length === 0) {
                             let all = Array.from(document.querySelectorAll('a'));
                             links = all.filter(a => a.href.includes('rpt9.php?action=create_rpt') || a.href.includes('rpt.php?action=create_rpt'));
                        }
                        
                        if(links.length > 0) {
                            let results = links.map(a => {
                                let title = a.innerText.trim();
                                if(!title) title = a.href;
                                return { title: title, url: a.href };
                            });
                            
                            // Remove duplicates
                            let unique = [];
                            let urls = new Set();
                            for(let r of results) {
                                if(!urls.has(r.url)) {
                                    unique.push(r);
                                    urls.add(r.url);
                                }
                            }
                            return unique;
                        }
                        return null;
                    }

                    return new Promise((resolve) => {
                        let attempts = 0;
                        let interval = setInterval(() => {
                            let rpts = findRPTs();
                            attempts++;
                            if(rpts) {
                                clearInterval(interval);
                                resolve(rpts);
                            } else if (attempts > 15) { // 15 seconds timeout
                                clearInterval(interval);
                                resolve([]);
                            }
                        }, 1000);
                    });
                })();
            `).then(uniqueRpts => {
                if (uniqueRpts && uniqueRpts.length > 0) {
                    console.log("Found RPTs:", uniqueRpts);
                    mainWindow.webContents.send('rpt-list', uniqueRpts);
                } else {
                    console.log("No RPTs found after polling.");
                    mainWindow.webContents.send('rpt-list', []);
                }
            }).catch(e => {
                console.error("Failed to extract RPT:", e);
                mainWindow.webContents.send('rpt-list', []);
            });
        }
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle('login', async (event, username, password) => {
    console.log("Attempting login via BrowserView");
    
    // Inject login script
    try {
        await loginView.webContents.executeJavaScript(`
            (function() {
                const u = document.querySelector('input[name="username"]');
                const p = document.querySelector('input[name="password"]');
                const btn = document.querySelector('button[type="submit"]');
                
                if (u && p) {
                    u.value = '${username}';
                    p.value = '${password}';
                    if (btn) btn.click();
                    else if (u.form) u.form.submit();
                    return true;
                }
                return false;
            })();
        `);
        return { started: true };
    } catch(e) {
        console.error(e);
        return { started: false, error: e.toString() };
    }
});

ipcMain.handle('open-rpt', async (event, url) => {
    // Reveal the BrowserView and show the selected RPT
    const bounds = mainWindow.getBounds();
    
    // Create a split view effect
    // Left: The CIDS website (RPT)
    // Right: The extension popup
    
    loginView.setBounds({ x: 0, y: 30, width: bounds.width - 320, height: bounds.height - 30 });
    loginView.webContents.loadURL(url);
    
    // Extension View (Popup)
    extPopupView = new BrowserView({
        webPreferences: {
            preload: require('path').join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    mainWindow.addBrowserView(extPopupView);
    extPopupView.setBounds({ x: bounds.width - 320, y: 30, width: 320, height: bounds.height - 30 });
    
    // We need to get the extension ID to load its popup
    const extensions = session.defaultSession.getAllExtensions();
    const cidsExt = extensions.find(e => e.name === "CIDS RPT AI Assist");
    if(cidsExt) {
        extPopupView.webContents.loadURL(`chrome-extension://${cidsExt.id}/popup.html`);
        
        // Inject a polyfill to intercept chrome.tabs.sendMessage and route it to our BrowserView
        extPopupView.webContents.on('dom-ready', () => {
             extPopupView.webContents.executeJavaScript(`
                 if (!window._ipcBridged) {
                     window._ipcBridged = true;
                     const originalSendMessage = chrome.tabs.sendMessage;
                     chrome.tabs.sendMessage = function(tabId, message, responseCallback) {
                          if (message.action === 'fillForm') {
                               if (window.electronAPI && window.electronAPI.fillForm) {
                                   window.electronAPI.fillForm(message.data);
                               }
                               setTimeout(() => { if(responseCallback) responseCallback({status: 'success'}); }, 500);
                          } else if (message.action === 'fillFormQueue') {
                               if (window.electronAPI && window.electronAPI.fillFormQueue) {
                                   window.electronAPI.fillFormQueue(message.data);
                               }
                               setTimeout(() => { if(responseCallback) responseCallback({status: 'success'}); }, 500);
                          } else {
                               originalSendMessage.apply(this, arguments);
                          }
                     };
                 }
             `);
        });
        
    } else {
        console.error("Extension not found!");
    }
    
    return true;
});

// Handle queue processing
let queueData = [];
let isProcessingQueue = false;

ipcMain.handle('fill-form-queue', (event, dataArray) => {
    console.log("Received fillFormQueue:", dataArray.length, "items");
    queueData = dataArray;
    if (!isProcessingQueue && queueData.length > 0) {
        processNextInQueue();
    }
});

function processNextInQueue() {
    if (queueData.length === 0) {
        isProcessingQueue = false;
        console.log("Queue finished.");
        if (extPopupView && extPopupView.webContents) {
            extPopupView.webContents.executeJavaScript(`
                 window.dispatchEvent(new CustomEvent('ELECTRON_QUEUE_FINISHED'));
            `).catch(e => console.error(e));
        }
        return;
    }
    isProcessingQueue = true;
    let nextItem = queueData.shift();
    console.log("Relaying queue item to RPT page:", nextItem.namaRekodForm);
    
    if (loginView && loginView.webContents) {
        loginView.webContents.executeJavaScript(`
             const evt = new CustomEvent('ELECTRON_FILL_DATA', { detail: ${JSON.stringify(nextItem)} });
             window.dispatchEvent(evt);
             document.querySelectorAll('iframe').forEach(f => {
                  try { f.contentWindow.dispatchEvent(new CustomEvent('ELECTRON_FILL_DATA', { detail: ${JSON.stringify(nextItem)} })); } catch(e){}
             });
        `);
    }
}

// When the RPT page finishes reloading after "Tambah", process the next item!
ipcMain.handle('page-reloaded', () => {
    if (isProcessingQueue) {
        console.log("Page reloaded, processing next item in queue...");
        setTimeout(() => {
            processNextInQueue();
        }, 3000); // Wait 3 seconds for page to be fully interactive
    }
});

// Listen for fillForm from the popup and forward it to the RPT page
ipcMain.handle('fill-form', (event, data) => {
    // Send it to loginView (which is currently showing the RPT page)
    console.log("Relaying fillForm data to RPT page", data);
    // Because we are not modifying the original content script, we can just trigger it using chrome.runtime.sendMessage in the loginView?
    // Actually, the original extension injects content.js into all pages. So content.js IS running in loginView!
    // But how to trigger it? The popup used `chrome.tabs.sendMessage`.
    // Wait, we can't use chrome.tabs.sendMessage from main process.
    // BUT we can use loginView.webContents.send() to send an IPC message, and if there's no IPC listener in content.js, that won't work.
    // BUT we can simply execute the global function from content.js!
    // In content.js, is there a global function `fillDataSequentially(data)`? Let's assume yes.
    loginView.webContents.executeJavaScript(`
        const data = ${JSON.stringify(data)};
        function broadcast(win) {
             win.dispatchEvent(new CustomEvent('ELECTRON_FILL_DATA', {detail: data}));
             for(let i=0; i<win.frames.length; i++) {
                 try { broadcast(win.frames[i]); } catch(e) {}
             }
        }
        broadcast(window);
    `).catch(console.error);
});
