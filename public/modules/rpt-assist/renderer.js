document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const rptDropdown = document.getElementById('rptDropdown');
    const openRptBtn = document.getElementById('openRptBtn');

    const api = window.electronAPI || window.parent.electronAPI;

    // Auto-login from settings
    if (api && api.getSettings) {
        api.getSettings().then(config => {
            if (config && config.username && config.password) {
                // Show loading state directly
                loginSection.innerHTML = '<div class="header"><h2>Log Masuk CIDS</h2><p class="status-msg info">Log Masuk Automatik CIDS...</p></div>';
                
                // Attempt login automatically
                api.login(config.username, config.password).then(result => {
                    if (!result.started) {
                        loginSection.innerHTML = '<div class="header"><h2>Ralat</h2><p class="status-msg error">Gagal memulakan proses log masuk. Sila semak tetapan.</p></div>';
                    }
                });
            } else {
                loginSection.innerHTML = '<div class="header"><h2>Sila Tetapkan Kelayakan</h2><p class="status-msg error">Sila masukkan ID Pengguna dan Kata Laluan di bahagian Tetapan (Settings).</p></div>';
            }
        });
    }

    // Handle Login Status
    if (api && api.onLoginStatus) {
        api.onLoginStatus((data) => {
            if (data.success) {
                loginSection.classList.remove('active');
                loginSection.classList.add('hidden');
                
                setTimeout(() => {
                    loginSection.style.display = 'none';
                    dashboardSection.style.display = 'block';
                    setTimeout(() => {
                        dashboardSection.classList.remove('hidden');
                        dashboardSection.classList.add('active');
                    }, 50);
                }, 400);
            } else {
                loginSection.innerHTML = '<div class="header"><h2>Ralat Log Masuk</h2><p class="status-msg error">Gagal log masuk CIDS. Sila semak semula ID Pengguna & Kata Laluan di Tetapan.</p></div>';
            }
        });
    }

    // Handle incoming RPT list from backend
    if (api && api.onRptList) {
        api.onRptList((list) => {
            rptDropdown.innerHTML = '';
            
            if (list.length === 0) {
                const option = document.createElement('option');
                option.text = 'Tiada RPT dijumpai';
                option.value = '';
                rptDropdown.add(option);
            } else {
                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.innerText = "Sila pilih RPT...";
                rptDropdown.appendChild(defaultOption);

                list.forEach(item => {
                    const option = document.createElement('option');
                    option.text = item.title;
                    option.value = item.url;
                    rptDropdown.add(option);
                });
            }
        });
    }

    // Enable button when RPT selected
    rptDropdown.addEventListener('change', (e) => {
        if(e.target.value) {
            openRptBtn.classList.remove('disabled');
            openRptBtn.disabled = false;
        } else {
            openRptBtn.classList.add('disabled');
            openRptBtn.disabled = true;
        }
    });

    // Handle opening RPT
    openRptBtn.addEventListener('click', () => {
        const url = rptDropdown.value;
        if(url) {
            openRptBtn.innerText = "Membuka...";
            openRptBtn.disabled = true;
            if (api) {
                api.openRpt(url);
            }
        }
    });
});
