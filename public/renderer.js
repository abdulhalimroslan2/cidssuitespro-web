document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.menu-item');
    const moduleFrame = document.getElementById('module-frame');

    // ─── RPT List Cache ───────────────────────────────────────────────────────
    // Cached here in the PARENT window (never reloads), so when user navigates
    // away and comes back to RPT Assist the list is delivered instantly.
    let cachedRptList = null;

    // Listen once for the RPT list event from main process
    if (window.electronAPI && window.electronAPI.onRptList) {
        window.electronAPI.onRptList((list) => {
            cachedRptList = list;
            // If RPT Assist iframe is currently visible, push data immediately
            const src = moduleFrame.getAttribute('src') || '';
            if (src.includes('rpt-assist') && moduleFrame.contentWindow) {
                moduleFrame.contentWindow.postMessage(
                    { type: 'cached-rpt-list', data: cachedRptList }, '*'
                );
            }
        });
    }

    // Whenever the iframe finishes loading, push cached list if on RPT Assist
    moduleFrame.addEventListener('load', () => {
        const src = moduleFrame.getAttribute('src') || '';
        if (src.includes('rpt-assist') && cachedRptList !== null && moduleFrame.contentWindow) {
            // Small delay to allow iframe DOMContentLoaded to finish
            setTimeout(() => {
                moduleFrame.contentWindow.postMessage(
                    { type: 'cached-rpt-list', data: cachedRptList }, '*'
                );
            }, 150);
        }
    });
    // ─────────────────────────────────────────────────────────────────────────

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const dataId = item.getAttribute('data-id');
            const target = item.getAttribute('data-target');

            // --- RPH Deleter Password Check ---
            if (dataId === 'deleter') {
                if (!sessionStorage.getItem('rphDeleterUnlocked')) {
                    const modal = document.getElementById('passwordModal');
                    const input = document.getElementById('modalPasswordInput');
                    const errorMsg = document.getElementById('modalErrorMsg');
                    const cancelBtn = document.getElementById('modalCancelBtn');
                    const submitBtn = document.getElementById('modalSubmitBtn');

                    // Reset modal state
                    input.value = '';
                    errorMsg.style.display = 'none';
                    modal.classList.add('show');
                    setTimeout(() => input.focus(), 100);

                    // Handle cancel
                    cancelBtn.onclick = () => {
                        modal.classList.remove('show');
                    };

                    // Handle submit
                    const checkPassword = () => {
                        if (input.value === 'saya ingin delete RPH') {
                            sessionStorage.setItem('rphDeleterUnlocked', 'true');
                            modal.classList.remove('show');
                            // Proceed with navigation
                            navigateMenu(item, target);
                        } else {
                            errorMsg.style.display = 'block';
                            input.focus();
                        }
                    };

                    submitBtn.onclick = checkPassword;
                    input.onkeydown = (ev) => {
                        if (ev.key === 'Enter') {
                            checkPassword();
                        }
                    };

                    return; // Stop execution, wait for password
                }
            }

            // Normal navigation if not restricted or already unlocked
            navigateMenu(item, target);
        });
    });

    function navigateMenu(item, target) {
        // Remove active class from all
        menuItems.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked
        item.classList.add('active');
        
        // Change iframe source
        if (target) {
            moduleFrame.src = target;
        }
        
        // Always hide active RPT ASIE View & Extension Popup when opening any menu item
        if (window.electronAPI && window.electronAPI.hideRptView) {
            window.electronAPI.hideRptView();
        }
    }

    // Handle clicking on the branding header to return to the dashboard
    const brandHeader = document.querySelector('.sidebar-header');
    if (brandHeader) {
        brandHeader.style.cursor = 'pointer';
        brandHeader.addEventListener('click', () => {
            menuItems.forEach(btn => btn.classList.remove('active'));
            moduleFrame.src = 'modules/dashboard/index.html';
            
            if (window.electronAPI && window.electronAPI.hideRptView) {
                window.electronAPI.hideRptView();
            }
        });
    }

    // Handle messages from the iframe
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'navigate') {
            const targetId = event.data.id;
            const menuItem = document.querySelector(`.menu-item[data-id="${targetId}"]`);
            if (menuItem) {
                menuItem.click();
            }
        }

        // RPT Assist iframe is requesting cached data
        if (event.data && event.data.type === 'request-rpt-cache') {
            if (cachedRptList !== null && moduleFrame.contentWindow) {
                moduleFrame.contentWindow.postMessage(
                    { type: 'cached-rpt-list', data: cachedRptList }, '*'
                );
            }
        }
    });

    // System Status Check
    async function updateSystemStatus() {
        if (window.electronAPI && window.electronAPI.checkSystemStatus) {
            const status = await window.electronAPI.checkSystemStatus();
            
            const asieLed = document.getElementById('status-asie');
            const apiLed = document.getElementById('status-api');
            const apiReason = document.getElementById('api-reason');
            
            if (asieLed) {
                asieLed.className = status.asie ? 'led led-green' : 'led led-red';
            }
            const asieLoginStatus = document.getElementById('asie-login-status');
            if (asieLoginStatus) {
                if (status.asie) {
                    asieLoginStatus.textContent = 'Log Masuk: Berjaya';
                    asieLoginStatus.style.color = '#34c759';
                } else {
                    asieLoginStatus.textContent = status.asieReason || 'Belum Log Masuk';
                    asieLoginStatus.style.color = '#ff3b30'; // Red
                }
            }
            if (apiLed) {
                apiLed.className = status.api ? 'led led-green' : 'led led-red';
            }
            
            if (apiReason) {
                if (status.api) {
                    apiReason.style.display = 'block';
                    if (status.isMaster) {
                        apiReason.textContent = 'Master API (Aktif)';
                        apiReason.style.color = '#ff9500'; // Orange
                    } else {
                        apiReason.textContent = 'API Key Pengguna (Aktif)';
                        apiReason.style.color = '#34c759'; // Bright Green
                    }
                } else {
                    apiReason.style.display = 'block';
                    apiReason.textContent = status.apiReason || 'Tiada API Key';
                    apiReason.style.color = '#ff3b30'; // Red
                }
            }
        }
    }

    // Initial check
    updateSystemStatus();
    // Check every 30 seconds
    setInterval(updateSystemStatus, 30000);
});
