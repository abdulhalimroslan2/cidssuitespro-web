document.addEventListener('DOMContentLoaded', () => {
    const api = window.electronAPI;

    // DOM Elements
    const step1Panel = document.getElementById('step1-panel');
    const step2Panel = document.getElementById('step2-panel');
    const step3Panel = document.getElementById('step3-panel');
    const step1Ind = document.getElementById('step1-indicator');
    const step2Ind = document.getElementById('step2-indicator');
    const step3Ind = document.getElementById('step3-indicator');
    const line1 = document.getElementById('line1');
    const line2 = document.getElementById('line2');
    const loginLoader = document.getElementById('loginLoader');
    const loginBadge = document.getElementById('loginBadge');
    const loginMsg = document.getElementById('loginMsg');
    const rptDropdown = document.getElementById('rptDropdown');
    const nextToStep3 = document.getElementById('nextToStep3');
    const openRptBtn = document.getElementById('openRptBtn');
    const backToStep2 = document.getElementById('backToStep2');
    const selectedRptName = document.getElementById('selectedRptName');

    let selectedRptUrl = '';

    function goToStep(stepNum) {
        // Hide all panels
        [step1Panel, step2Panel, step3Panel].forEach(p => p.classList.remove('active'));
        [step1Ind, step2Ind, step3Ind].forEach(s => { s.classList.remove('active'); s.classList.remove('completed'); });
        line1.classList.remove('active');
        line2.classList.remove('active');

        if (stepNum === 1) {
            step1Panel.classList.add('active');
            step1Ind.classList.add('active');
        } else if (stepNum === 2) {
            step2Panel.classList.add('active');
            step1Ind.classList.add('completed');
            step2Ind.classList.add('active');
            line1.classList.add('active');
        } else if (stepNum === 3) {
            step3Panel.classList.add('active');
            step1Ind.classList.add('completed');
            step2Ind.classList.add('completed');
            step3Ind.classList.add('active');
            line1.classList.add('active');
            line2.classList.add('active');
        }
    }

    // Step 1: Auto-login
    if (api && api.getSettings) {
        api.getSettings().then(config => {
            if (config && config.username && config.password) {
                loginMsg.textContent = 'Sedang log masuk ke portal ASIE Model secara automatik...';
                
                api.login(config.username, config.password).then(result => {
                    if (!result.started) {
                        loginLoader.style.display = 'none';
                        loginMsg.textContent = 'Gagal memulakan proses log masuk. Sila semak tetapan.';
                        loginBadge.style.display = 'inline-flex';
                        loginBadge.classList.add('error');
                        loginBadge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg><span>Ralat</span>';
                    }
                });
            } else {
                loginLoader.style.display = 'none';
                loginMsg.textContent = 'Tiada kelayakan log masuk ditemui. Sila isi di Tetapan (Settings).';
                loginBadge.style.display = 'inline-flex';
                loginBadge.classList.add('error');
                loginBadge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg><span>Tiada Kelayakan</span>';
            }
        });
    }

    // Listen for login status
    if (api && api.onLoginStatus) {
        api.onLoginStatus((data) => {
            if (data.success) {
                loginLoader.style.display = 'none';
                loginBadge.style.display = 'inline-flex';
                loginMsg.textContent = 'Berjaya disambungkan ke portal ASIE Model.';

                // Auto-advance to step 2 after short delay
                setTimeout(() => {
                    goToStep(2);
                }, 1200);
            } else {
                loginLoader.style.display = 'none';
                loginMsg.textContent = 'Gagal log masuk. Sila semak ID Pengguna & Kata Laluan di Tetapan.';
                loginBadge.style.display = 'inline-flex';
                loginBadge.classList.add('error');
                loginBadge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg><span>Gagal Log Masuk</span>';
            }
        });
    }

    // Listen for RPT list
    if (api && api.onRptList) {
        api.onRptList((list) => {
            rptDropdown.innerHTML = '';

            if (list.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Tiada RPT dijumpai';
                rptDropdown.appendChild(opt);
            } else {
                const defaultOpt = document.createElement('option');
                defaultOpt.value = '';
                defaultOpt.textContent = 'Sila pilih RPT...';
                rptDropdown.appendChild(defaultOpt);

                list.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item.url;
                    opt.textContent = item.title;
                    rptDropdown.appendChild(opt);
                });
            }
        });
    }

    // RPT Dropdown change
    rptDropdown.addEventListener('change', (e) => {
        if (e.target.value) {
            nextToStep3.classList.remove('disabled');
            nextToStep3.disabled = false;
            selectedRptUrl = e.target.value;
        } else {
            nextToStep3.classList.add('disabled');
            nextToStep3.disabled = true;
            selectedRptUrl = '';
        }
    });

    // Next to Step 3
    nextToStep3.addEventListener('click', () => {
        if (!selectedRptUrl) return;
        const selectedText = rptDropdown.options[rptDropdown.selectedIndex].text;
        selectedRptName.textContent = selectedText;
        goToStep(3);
    });

    // Back to Step 2
    backToStep2.addEventListener('click', () => {
        goToStep(2);
    });

    // Open RPT & Launch AI Assist
    openRptBtn.addEventListener('click', () => {
        if (selectedRptUrl && api && api.openRpt) {
            openRptBtn.innerHTML = '<svg viewBox="0 0 24 24" style="animation: spin 1s linear infinite"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill="white"/></svg> Membuka RPT...';
            openRptBtn.disabled = true;
            api.openRpt(selectedRptUrl);
        }
    });
});
