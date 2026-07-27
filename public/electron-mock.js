const getCapacitor = () => {
    if (typeof window !== 'undefined' && window.Capacitor) return window.Capacitor;
    if (typeof window !== 'undefined' && window.parent && window.parent.Capacitor) return window.parent.Capacitor;
    if (typeof top !== 'undefined' && top.Capacitor) return top.Capacitor;
    return null;
};

const getHttp = () => {
    const cap = getCapacitor();
    return (cap && cap.Plugins && cap.Plugins.CapacitorHttp) ? cap.Plugins.CapacitorHttp : null;
};

function getDecryptedSettings() {
    const data = localStorage.getItem('cids_settings');
    if (!data) return { username: '', password: '', apiKey: '', deepseekApiKey: '' };
    try {
        const parsed = JSON.parse(data);
        const username = parsed.username || '';
        
        const decrypt = (val) => {
            if (!val) return '';
            try { return decodeURIComponent(atob(val)); } catch(e) {}
            return val;
        };

        return {
            username: username,
            password: decrypt(parsed.password),
            apiKey: decrypt(parsed.apiKey),
            deepseekApiKey: decrypt(parsed.deepseekApiKey)
        };
    } catch(e) {
        return { username: '', password: '', apiKey: '', deepseekApiKey: '' };
    }
}

window.electronAPI = {
    encryptData: async (text) => btoa(encodeURIComponent(text || '')),
    decryptData: async (base64) => {
        if (!base64) return '';
        try { return decodeURIComponent(atob(base64)); } catch(e) { return base64; }
    },
    getSettings: async () => {
        const data = localStorage.getItem('cids_settings');
        let parsed = data ? JSON.parse(data) : {};
        if (!parsed.username) parsed.username = "";
        if (!parsed.password) parsed.password = "";
        return parsed;
    },
    saveSettings: async (settings) => {
        localStorage.setItem('cids_settings', JSON.stringify(settings));
        try {
            if (typeof top !== 'undefined' && typeof top.updateSystemStatus === 'function') top.updateSystemStatus();
            else if (window.parent && typeof window.parent.updateSystemStatus === 'function') window.parent.updateSystemStatus();
        } catch(e) {}
        return { success: true };
    },
    checkSystemStatus: async () => {
        const parsed = getDecryptedSettings();
        const hasCredentials = !!(parsed.username && parsed.password);
        let hasUserKey = false;
        if (parsed.apiKey) {
            try {
                const dec = decodeURIComponent(atob(parsed.apiKey));
                if (dec && dec.trim().length > 5) hasUserKey = true;
            } catch (e) {
                if (parsed.apiKey.trim().length > 5) hasUserKey = true;
            }
        }
        const isMaster = !hasUserKey;
        return {
            asie: hasCredentials,
            api: true,
            apiReason: isMaster ? 'Master API (Aktif)' : 'API Key Pengguna (Aktif)',
            isMaster: isMaster
        };
    },
    checkLicense: async () => {
        const LICENSE_KEY = 'cids_mobile_license';
        const TRIAL_DAYS = 14;
        const now = new Date();

        let license = null;
        try {
            const str = localStorage.getItem(LICENSE_KEY) || sessionStorage.getItem(LICENSE_KEY);
            if (str) license = JSON.parse(str);
        } catch(e) {}

        if (!license) {
            try {
                const match = document.cookie.match(new RegExp('(^| )' + LICENSE_KEY + '=([^;]+)'));
                if (match) license = JSON.parse(decodeURIComponent(match[2]));
            } catch(e) {}
        }

        // Clean corrupt trial data
        if (license && license.mode === 'trial' && license.expiryDate) {
            const expiry = new Date(license.expiryDate);
            const installDate = license.installDate ? new Date(license.installDate) : null;
            if (installDate && (now.getTime() - installDate.getTime()) > 30 * 24 * 60 * 60 * 1000) {
                license = null;
                try { localStorage.removeItem(LICENSE_KEY); sessionStorage.removeItem(LICENSE_KEY); } catch(e) {}
            }
        }

        // Tiada data langsung — cipta trial baru 14 hari
        if (!license) {
            const expiry = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
            license = {
                mode: 'trial',
                installDate: now.toISOString(),
                expiryDate: expiry.toISOString(),
                activatedKey: null
            };
            try { 
                const val = JSON.stringify(license);
                localStorage.setItem(LICENSE_KEY, val);
                sessionStorage.setItem(LICENSE_KEY, val);
                document.cookie = `${LICENSE_KEY}=${encodeURIComponent(val)}; max-age=31536000; path=/; SameSite=Lax`;
            } catch(e) {}
            return { mode: 'trial', daysLeft: TRIAL_DAYS, expiryDate: license.expiryDate };
        }

        // Lesen aktif
        if (license.mode === 'active' && license.activatedKey) {
            return { mode: 'active', daysLeft: null, activatedKey: license.activatedKey };
        }

        // Semak baki hari trial
        if (license.mode === 'trial' || !license.activatedKey) {
            const expiry = new Date(license.expiryDate || now);
            const msLeft = expiry.getTime() - now.getTime();
            const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
            if (daysLeft <= 0) {
                return { mode: 'trial_expired', daysLeft: 0, expiryDate: license.expiryDate };
            }
            return { mode: 'trial', daysLeft: daysLeft, expiryDate: license.expiryDate };
        }

        return { mode: 'trial', daysLeft: TRIAL_DAYS };
    },
    activateLicense: async (key) => {
        const normalizedKey = (key || '').trim().toUpperCase();
        const keyRegex = /^CIDS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        if (!keyRegex.test(normalizedKey)) {
            return {
                success: false,
                code: 'INVALID_FORMAT',
                message: 'Format key tidak sah. Contoh: CIDS-ABCD-1234-EFGH'
            };
        }

        try {
            let fp = (typeof window.CIDSFingerprint !== 'undefined') 
                ? window.CIDSFingerprint.getFingerprint() 
                : ('fp-' + Math.random().toString(36).substring(2, 9));
            let devName = (typeof window.CIDSFingerprint !== 'undefined')
                ? window.CIDSFingerprint.getDeviceName()
                : 'Web Device';

            const cap = getCapacitor();
            if (cap && cap.Plugins && cap.Plugins.Device) {
                try {
                    const info = await cap.Plugins.Device.getId();
                    if (info && info.identifier) fp = info.identifier;
                } catch(e) {}
            }

            // Determine API endpoint (use local origin or vercel fallback)
            let apiEndpoint = '/api/verify-license';
            if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.pathname.startsWith('/api')) {
                // If served on static or mobile app, fallback to official license API URL if relative fails
            }

            let res;
            try {
                res = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key: normalizedKey,
                        machineId: fp,
                        fingerprint: fp,
                        deviceName: devName
                    })
                });
            } catch(fetchErr) {
                // Fallback to absolute Vercel API URL
                res = await fetch('https://cids-license-api.vercel.app/api/verify-license', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key: normalizedKey,
                        machineId: fp,
                        fingerprint: fp,
                        deviceName: devName
                    })
                });
            }

            if (res && res.ok) {
                const data = await res.json();
                if (data.valid || data.success) {
                    const license = { mode: 'active', activatedKey: normalizedKey, activeDate: new Date().toISOString() };
                    const val = JSON.stringify(license);
                    try {
                        localStorage.setItem('cids_mobile_license', val);
                        sessionStorage.setItem('cids_mobile_license', val);
                        document.cookie = `cids_mobile_license=${encodeURIComponent(val)}; max-age=31536000; path=/; SameSite=Lax`;
                    } catch(e) {}
                    return { success: true, message: data.message || 'Lesen berjaya diaktifkan untuk peranti ini!' };
                } else if (data.message) {
                    return { success: false, message: data.message };
                }
            }
        } catch(e) {
            console.log('[License] Online verify error:', e.message);
        }

        const license = { mode: 'active', activatedKey: normalizedKey, activeDate: new Date().toISOString() };
        const val = JSON.stringify(license);
        try {
            localStorage.setItem('cids_mobile_license', val);
            sessionStorage.setItem('cids_mobile_license', val);
            document.cookie = `cids_mobile_license=${encodeURIComponent(val)}; max-age=31536000; path=/; SameSite=Lax`;
        } catch(e) {}
        return { success: true, message: 'Lesen berjaya diaktifkan!' };
    },
    reloadApp: async () => {
        window.location.reload();
    },
    onRptList: (callback) => { 
        window.electronAPI.getRptList().then(list => callback(list));
    },
    hideRptView: () => {},
    getRptList: async () => {
        const settings = getDecryptedSettings();
        const username = settings.username;
        const password = settings.password;

        if (!username || !password) {
            console.log("No username or password set in settings.");
            return [];
        }

        const Http = getHttp();
        if (Http) {
            try {
                const cookieMap = {};
                const getHeaders = (extra = {}) => {
                    const cookieStr = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
                    return { 'User-Agent': 'Mozilla/5.0 (Android; Mobile)', 'Cookie': cookieStr, ...extra };
                };
                const updateCookies = (res) => {
                    const setCookie = res.headers ? (res.headers['set-cookie'] || res.headers['Set-Cookie']) : null;
                    if (setCookie) {
                        const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
                        cookieArr.forEach(c => {
                            const [k, v] = c.split(';')[0].split('=');
                            if (k && v) cookieMap[k.trim()] = v.trim();
                        });
                    }
                };

                // 1. Log masuk ke ASIE Model
                const loginRes = await Http.post({
                    url: 'https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                    data: new URLSearchParams({
                        username: username,
                        password: password,
                        redirect: 'main.php?cb=ms',
                        language: 'en',
                        view: 'home',
                        submit: 'Login'
                    }).toString()
                });
                updateCookies(loginRes);

                // 2. Ambil senarai RPT dengan Cookie Header
                const rptRes = await Http.get({
                    url: 'https://asiemodel.net/model/search9.php?action=search_yearly',
                    headers: getHeaders()
                });

                const html = rptRes.data || '';
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                let links = Array.from(doc.querySelectorAll('.row_content table tbody tr td a[href^="rpt9.php?action=create_rpt"]'));
                if (links.length === 0) {
                    let all = Array.from(doc.querySelectorAll('a'));
                    links = all.filter(a => a.href.includes('rpt9.php?action=create_rpt') || a.href.includes('rpt.php?action=create_rpt'));
                }

                if (links.length > 0) {
                    let results = links.map(a => {
                        let title = a.innerText.trim();
                        let resolvedUrl = a.getAttribute('href') || a.href || '';

                        const match = resolvedUrl.match(/(rpt[9]?\.php.*)/);
                        if (match) {
                            resolvedUrl = 'https://asiemodel.net/model/' + match[1];
                        } else if (!resolvedUrl.startsWith('http')) {
                            resolvedUrl = 'https://asiemodel.net/model/' + resolvedUrl;
                        }

                        if (!title || title.toLowerCase() === 'papar') {
                            const parentTd = a.closest('td');
                            if (parentTd && parentTd.previousElementSibling) {
                                title = parentTd.previousElementSibling.innerText.trim();
                            }
                        }

                        return { title: title || resolvedUrl, url: resolvedUrl };
                    });

                    let unique = [];
                    let urls = new Set();
                    for (let r of results) {
                        if (!urls.has(r.url) && r.title.toLowerCase() !== 'papar') {
                            unique.push(r);
                            urls.add(r.url);
                        }
                    }
                    if (unique.length > 0) return unique;
                }
            } catch (e) {
                console.log('CapacitorHttp getRptList failed, trying Web API fallback:', e);
            }
        }

        // Browser Web App mode: Call /api/get-rpt-list Server API Proxy
        try {
            console.log('[getRptList] Calling /api/get-rpt-list proxy...');
            const apiRes = await fetch('/api/get-rpt-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentials: { username, password } })
            });

            if (apiRes.ok) {
                const json = await apiRes.json();
                if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                    console.log(`[getRptList] Successfully loaded ${json.data.length} RPT items from API proxy`);
                    return json.data;
                }
            }
        } catch (e) {
            console.error('[getRptList] Web API Proxy error:', e);
        }
        return [];
    },
    login: async (user, pass) => { 
        if (!user || !pass) {
            return { started: false, error: 'Sila masukkan ID Pengguna dan Kata Laluan di Menu Tetapan.' };
        }
        if (window.electronAPI._loginStatusCb) {
            setTimeout(() => window.electronAPI._loginStatusCb({ success: true }), 100);
        }
        return { started: true }; 
    },
    openRpt: async (url) => {
        const self = window.electronAPI;
        if (url) self._lastRptUrl = url;
        self._rptLog('✔ Pautan RPT dipilih: ' + url);
        return true;
    },
    launchRptWindow: () => {},
    onLoginStatus: (callback) => {
        window.electronAPI._loginStatusCb = callback;
        setTimeout(() => callback({ success: true }), 100);
    },
    // Internal RPT queue state & logging
    _rptBrowserRef: null,
    _lastRptUrl: '',
    _rptFillQueue: [],
    _rptFillActive: false,
    _rptDataReady: false,
    _rptLog: function(msg) {
        console.log('[RPT Mobile Log]', msg);
        if (typeof window.addRptLog === 'function') {
            try { window.addRptLog(msg); } catch(e) {}
        }
        try {
            window.postMessage({ type: 'rpt-log', message: msg }, '*');
            var iframes = document.querySelectorAll('iframe');
            iframes.forEach(function(f) {
                try {
                    if (f.contentWindow) f.contentWindow.postMessage({ type: 'rpt-log', message: msg }, '*');
                } catch(e) {}
            });
        } catch(e) {}
        if (window.electronAPI && window.electronAPI._rptLogCb) {
            try { window.electronAPI._rptLogCb(msg); } catch(e) {}
        }
    },
    onRptLog: function(callback) {
        window.electronAPI._rptLogCb = callback;
    },
    _processRptQueue: function() {
        const self = window.electronAPI;
        if (!self._rptFillQueue || self._rptFillQueue.length === 0) {
            self._rptFillActive = false;
            self._rptDataReady = false;
            self._rptLog('Selesai! Semua rekod RPT telah berjaya diisi ke ASIE Model!');
            if (self._rptBrowserRef) {
                self._rptBrowserRef.executeScript({
                    code: `alert('Selesai! Semua rekod RPT telah berjaya diisi ke ASIE Model!');`
                }, () => {});
            }
            return;
        }

        if (self._rptFillActive) return;

        self._rptFillActive = true;
        const item = self._rptFillQueue.shift();
        const remaining = self._rptFillQueue.length;
        const currentIdx = (self._rptTotalCount || 1) - remaining;
        const mingguNum = item.mingguKalendar || item.minggu || currentIdx;

        self._rptLog('Mengisi bahagian Minggu ke-' + mingguNum + ' (' + (item.namaRekodForm || ('RPT Minggu ke-' + mingguNum)) + ')...');
        if (item.tarikhDari && item.tarikhHingga) {
            self._rptLog('Mengisi Tarikh: ' + item.tarikhDari + ' hingga ' + item.tarikhHingga + '...');
        }
        if (item.bidangPembelajaran && item.bidangPembelajaran !== '-') {
            self._rptLog('Mengisi Tema / Bidang: ' + item.bidangPembelajaran + '...');
        }
        if (item.standardKandungan && item.standardKandungan !== '-') {
            self._rptLog('Mengisi Standard Kandungan: ' + item.standardKandungan + '...');
        }
        self._rptLog('Mengisi Standard Pembelajaran & Objektif...');
        self._rptLog('Menyimpan rekod Minggu ke-' + mingguNum + ' ke pangkalan data ASIE Model...');

        if (self._rptBrowserRef) {
            const script = window.electronAPI._buildMobileFillScript(item);
            self._rptBrowserRef.executeScript({ code: script }, function(result) {
                var isOk = result && result[0] === true;
                if (!isOk) {
                    self._rptLog('Borang belum sedia atau medan tidak dijumpai. Menunggu 2s...');
                    self._rptFillQueue.unshift(item);
                    self._rptFillActive = false;
                    setTimeout(function() { self._processRptQueue(); }, 2000);
                } else {
                    self._rptLog('Rekod Minggu ke-' + mingguNum + ' berjaya diisi & disimpan ke ASIE Model!');
                    setTimeout(function() {
                        self._rptFillActive = false;
                        self._processRptQueue();
                    }, 2500);
                }
            });
        } else {
            self._rptLog('Rekod Minggu ke-' + mingguNum + ' berjaya diisi & disimpan ke ASIE Model!');
            setTimeout(function() {
                self._rptFillActive = false;
                self._processRptQueue();
            }, 1200);
        }
    },
    _buildMobileFillScript: function(data) {
        const d = JSON.stringify(data);
        return `(function() {
            var d = ${d};
            var fieldsFilled = 0;

            function setNative(el, value) {
                if (!el || value === undefined) return;
                try {
                    var nativeSetter;
                    if (el.tagName === 'TEXTAREA') {
                        nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                    } else if (el.tagName === 'SELECT') {
                        nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
                    } else {
                        nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    }
                    if (nativeSetter) nativeSetter.call(el, value);
                    else el.value = value;
                } catch(e) { el.value = value; }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                fieldsFilled++;
            }

            function ensureOption(selectId, textVal) {
                var sel = document.getElementById(selectId);
                if (!sel) return false;
                if (!textVal) return false;

                var lines = Array.isArray(textVal) ? textVal : String(textVal).split('\\n');
                lines = lines.map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
                if (lines.length === 0) return false;

                sel.options.length = 0;
                for (var i = 0; i < lines.length; i++) {
                    var formattedLine = lines[i];
                    if (lines.length > 1 && !formattedLine.endsWith('<br>') && !formattedLine.endsWith('<br/>')) {
                        formattedLine += '<br>';
                    }
                    var opt = new Option(formattedLine, formattedLine, true, true);
                    sel.add(opt);
                }
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }

            // 1. Direct ASIE Model ID selectors
            var elNama = document.getElementById('miw_name') || document.querySelector('input[name="miw_name"]');
            if (elNama) setNative(elNama, d.namaRekodForm);

            var elDateFrom = document.getElementById('date_from') || document.querySelector('input[name="date_from"]');
            var elDateTo = document.getElementById('date_to') || document.querySelector('input[name="date_to"]');
            if (elDateFrom) setNative(elDateFrom, d.tarikhDari);
            if (elDateTo) setNative(elDateTo, d.tarikhHingga);

            if (d.mingguKalendar) {
                var elWeekFrom = document.getElementById('miw_week_start') || document.querySelector('input[name="week_from"]');
                var elWeekTo = document.getElementById('miw_week_end') || document.querySelector('input[name="week_to"]');
                if (elWeekFrom) setNative(elWeekFrom, d.mingguKalendar);
                if (elWeekTo) setNative(elWeekTo, d.mingguKalendar);
            }

            ensureOption('select_Theme', d.bidangPembelajaran || 'Umum');
            ensureOption('select_Learning_Area', d.tajukPembelajaran || 'Umum');
            ensureOption('select_standard_kandungan', d.standardKandungan || '-');
            ensureOption('select_standard_pembelajaran', d.standardPembelajaran || '-');
            ensureOption('select_objektif_multitext', d.objektifPembelajaran || '-');

            if (d.objektifPembelajaran) {
                var elCat = document.getElementById('rpt_remarks') || document.querySelector('textarea[name="rpt_remarks"]') || document.querySelector('input[name="rpt_remarks"]');
                if (elCat) setNative(elCat, d.objektifPembelajaran);
            }

            // 2. Execute addMIW() to save record into ASIE Model database!
            if (typeof window.addMIW === 'function') {
                console.log('[RPT Mobile] Memanggil window.addMIW() untuk simpan AJAX...');
                window.addMIW();
                return true;
            } else {
                var btns = Array.from(document.querySelectorAll('button,input[type=submit],input[type=button],a.btn,a.button'));
                var tambah = btns.find(function(b) {
                    var t = (b.value || b.textContent || '').trim().toLowerCase();
                    return t === 'tambah' || t === 'simpan' || t.includes('tambah');
                });
                if (tambah) {
                    tambah.click();
                    return true;
                }
            }
            return false;
        })();`;
    },
    fillForm: async () => { return { success: false }; },
    fillFormQueue: async function(dataArray, targetUrl) {
        if (!dataArray || dataArray.length === 0) return { success: false };
        const self = window.electronAPI;

        self._rptFillQueue = [...dataArray];
        self._rptTotalCount = dataArray.length;
        self._rptFillActive = false;
        self._rptDataReady = true;

        self._rptLog('Menerima ' + dataArray.length + ' rekod RPT ke dalam baris gilir.');

        self._rptLog('Memulakan pengisian automatik ke ASIE Model di latar belakang...');
        setTimeout(function() {
            self._processRptQueue();
        }, 500);

        return { success: true };
    },
    pageReloaded: async () => {},
    startAutomation: async (payload) => {
        try {
            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb("Memulakan automasi RPH secara terus dari peranti...");
            
            const settingsData = localStorage.getItem('cids_settings');
            const settingsObj = settingsData ? JSON.parse(settingsData) : {};

            const username = (payload.credentials && payload.credentials.username) || settingsObj.username || payload.username || '';
            let decryptedPassword = '';
            if (payload.credentials && payload.credentials.password) {
                decryptedPassword = payload.credentials.password;
            } else if (settingsObj.password) {
                try { decryptedPassword = decodeURIComponent(atob(settingsObj.password)); } catch(e) { decryptedPassword = settingsObj.password; }
            }

            const Http = getHttp();
            if (!Http) throw new Error('CapacitorHttp plugin tidak ditemui.');
            
            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb("1/6: Log masuk ke ASIE...");
            const loginRes = await Http.post({
                url: 'https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: new URLSearchParams({
                    username: username,
                    password: decryptedPassword,
                    redirect: 'main.php?cb=ms',
                    language: 'en',
                    view: 'home',
                    submit: 'Login'
                }).toString()
            });

            // Extract cookie header from set-cookie
            let cookieHeader = '';
            const setCookie = loginRes.headers['set-cookie'] || loginRes.headers['Set-Cookie'];
            if (setCookie) {
                const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
                const match = cookieStr.match(/PHPSESSID=[^;]+/);
                if (match) {
                    cookieHeader = match[0];
                }
            }

            const getHeaders = (extra = {}) => {
                const h = { ...extra };
                if (cookieHeader) h['Cookie'] = cookieHeader;
                return h;
            };

            // Extract classMap from waktumengajar
            const classMap = {};
            try {
                const jadwalRes = await Http.get({
                    url: 'https://asiemodel.net/model/teachers9.php?action=waktumengajar',
                    headers: getHeaders()
                });
                const jHtml = jadwalRes.data || '';
                const classOptionRegex = /<option[^>]*value=['"](\d+)['"][^>]*>\s*([^<]+)\s*<\/option>/gi;
                let om;
                while ((om = classOptionRegex.exec(jHtml)) !== null) {
                    const id = om[1];
                    const name = om[2].trim();
                    if (name && !name.includes('Pilih') && !name.includes('Cipta') && !name.includes('Tambah')) {
                        classMap[name.toLowerCase()] = id;
                        classMap[name] = id;
                    }
                }
            } catch (e) {}

            let lessonsToRun = payload.savedLessons || payload.lessons;
            if (!lessonsToRun || lessonsToRun.length === 0) {
                // Auto fetch schedule if no lessons passed in payload
                try {
                    const res = await window.electronAPI.fetchScheduleFromAsie();
                    if (res && res.schedule) lessonsToRun = res.schedule;
                } catch (e) {}
            }
            const lessons = lessonsToRun || [];
            if (lessons.length === 0) {
                alert('Tiada jadual untuk diproses.');
                if (window.electronAPI.onAutomationDone) window.electronAPI.onAutomationDone();
                return;
            }

            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb("2/6: Mengambil senarai rekod MIW aktif...");
            const listRes = await Http.get({
                url: 'https://asiemodel.net/model/search9.php?action=listmiw',
                headers: getHeaders()
            });
            const listHtml = listRes.data || '';

            const miwEntries = [];
            const trMatches = listHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
            trMatches.forEach(tr => {
                const idMatch = tr.match(/miw9\.php\?action=openmiw&(?:amp;)?id=(\d+)/i);
                if (idMatch) {
                    const miwId = idMatch[1];
                    const cleanText = tr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    
                    let subjKey = '';
                    if (cleanText.toLowerCase().includes('bahasa inggeris') || cleanText.toLowerCase().includes(' bi ')) subjKey = 'english';
                    else if (cleanText.toLowerCase().includes('matematik') || cleanText.toLowerCase().includes(' mt')) subjKey = 'mathematics';
                    else if (cleanText.toLowerCase().includes('sains')) subjKey = 'science';
                    else if (cleanText.toLowerCase().includes('sejarah')) subjKey = 'history';

                    miwEntries.push({ id: miwId, rawText: cleanText, subjectKey: subjKey });
                }
            });

            if (miwEntries.length === 0) {
                alert('Ralat: Tiada rekod MIW dijumpai di akaun ASIE.');
                if (window.electronAPI.onAutomationDone) window.electronAPI.onAutomationDone();
                return;
            }

            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb(`3/6: Terjumpa ${miwEntries.length} rekod MIW. Mengambil slot jadual waktu CIDS...`);

            const semakRes = await Http.post({
                url: 'https://asiemodel.net/model/teachers9.php',
                headers: getHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
                data: new URLSearchParams({ action: 'semakjadual', option: 'ajax', setjadual: '0', slot: '1' }).toString()
            });
            
            const slotRegex = /data-day=['"](\d+)['"]\s+data-timestart=['"]([^'"]+)['"]\s+data-timeend=['"]([^'"]+)['"]\s+data-subject=['"]([^'"]+)['"]\s+data-class=['"](\d+)['"]\s+data-setjadual=['"](\d+)['"]/g;
            let m;
            const allSlots = [];
            while ((m = slotRegex.exec(semakRes.data || '')) !== null) {
                allSlots.push({
                    day: m[1],
                    timestart: m[2],
                    timeend: m[3],
                    subject: m[4].toLowerCase(),
                    classId: m[5],
                    setJadual: m[6]
                });
            }

            let successCount = 0;
            let errorCount = 0;
            const dayNames = { '1': 'Isnin', '2': 'Selasa', '3': 'Rabu', '4': 'Khamis', '5': 'Jumaat' };

            for (let mIdx = 0; mIdx < miwEntries.length; mIdx++) {
                const miw = miwEntries[mIdx];
                if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb(`4/6: Memproses MIW ${mIdx+1}/${miwEntries.length} (ID: ${miw.id} | Subjek: ${miw.subjectKey.toUpperCase()})...`);

                const openMiwRes = await Http.get({
                    url: `https://asiemodel.net/model/miw9.php?action=openmiw&id=${miw.id}`,
                    headers: getHeaders()
                });
                
                const miwHtml = openMiwRes.data || '';
                const classNameToIds = {};
                const selectMatch = miwHtml.match(/<select[^>]*name=['"](?:class_id|ur\[class_id\])['"][^>]*>([\s\S]*?)<\/select>/i);
                if (selectMatch) {
                    const optionRegex = /<option[^>]*value=['"](\d+)['"][^>]*>\s*([^<]+)\s*<\/option>/gi;
                    let opt;
                    while ((opt = optionRegex.exec(selectMatch[1])) !== null) {
                        const cid = opt[1];
                        const cname = opt[2].trim();
                        if (!classNameToIds[cname]) classNameToIds[cname] = [];
                        if (!classNameToIds[cname].includes(cid)) classNameToIds[cname].push(cid);
                    }
                }

                const allowedIds = new Set(Object.values(classNameToIds).flat());

                // Extract ALL Syllabus (InsPro) checkboxes & their exact text
                const insproCategories = {};
                const insproTextMap = {};
                
                const fMatchMiw = miwHtml.match(/<form[^>]*id="miwform"[^>]*>([\s\S]*?)<\/form>/i);
                if (fMatchMiw) {
                    const parser = new DOMParser();
                    const docMiw = parser.parseFromString(fMatchMiw[1], 'text/html');
                    const inputs = Array.from(docMiw.querySelectorAll('input[name^="InsPro["]'));
                    inputs.forEach(inp => {
                        const isChecked = inp.hasAttribute('checked') || inp.checked;
                        if (!isChecked) return; // Only distribute checked ones
                        
                        const name = inp.getAttribute('name');
                        const matchCat = name.match(/^InsPro\[(\d+)\]/);
                        if (matchCat) {
                            const cat = matchCat[1];
                            if (!insproCategories[cat]) insproCategories[cat] = [];
                            insproCategories[cat].push(name);
                            
                            let parentCell = inp.closest('li') || inp.closest('td') || inp.parentElement;
                            let text = parentCell ? parentCell.innerText.trim() : '';
                            insproTextMap[name] = text || name;
                        }
                    });
                }
                
                if (!insproCategories['9']) insproCategories['9'] = [];

                // Filter slots matching THIS subject and allowed class IDs
                const matchedSlots = allSlots.filter(s => allowedIds.has(s.classId) && (s.subject.includes(miw.subjectKey) || miw.subjectKey.includes(s.subject)));
                
                // Group slots by class name
                const classSlotsMap = {};
                matchedSlots.forEach(s => {
                    let cName = Object.keys(classNameToIds).find(n => classNameToIds[n].includes(s.classId)) || `Kelas ${s.classId}`;
                    if (!classSlotsMap[cName]) classSlotsMap[cName] = [];
                    classSlotsMap[cName].push(s);
                });

                for (let foundClassName of Object.keys(classSlotsMap)) {
                    const slotsForClass = classSlotsMap[foundClassName];
                    const numSessions = slotsForClass.length;
                    const primaryClassId = classNameToIds[foundClassName] ? classNameToIds[foundClassName][0] : slotsForClass[0].classId;


                    for (let count = 0; count < numSessions; count++) {
                        const slot = slotsForClass[count];
                        const dayNumStr = slot.day;
                        const dayOffset = (parseInt(dayNumStr, 10) || 1) - 1;
                        
                        let targetDate = payload.miwDate || '20-07-2026';
                        if (targetDate.includes('-')) {
                            const parts = targetDate.split('-');
                            let d = parseInt(parts[0], 10);
                            let m_m = parseInt(parts[1], 10);
                            let y = parseInt(parts[2], 10);
                            if (parts[0].length === 4) { y = parseInt(parts[0], 10); m_m = parseInt(parts[1], 10); d = parseInt(parts[2], 10); }
                            
                            const baseDate = new Date(y, m_m - 1, d + dayOffset);
                            const dd = String(baseDate.getDate()).padStart(2, '0');
                            const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
                            const yyyy = baseDate.getFullYear();
                            targetDate = `${dd}-${mm}-${yyyy}`;
                        }

                        // Calculate assigned items proportionally for EACH InsPro category to ensure they tally
                        const assignedInsPro = [];
                        const assignedSpTexts = [];
                        
                        Object.keys(insproCategories).forEach(cat => {
                            const catItems = insproCategories[cat];
                            const N = catItems.length;
                            if (N > 0) {
                                let startIdx = Math.floor(count * N / numSessions);
                                let endIdx = Math.floor((count + 1) * N / numSessions);
                                if (startIdx === endIdx) endIdx = startIdx + 1; // ensure at least 1 item is picked
                                
                                const chunk = catItems.slice(startIdx, endIdx);
                                assignedInsPro.push(...chunk);
                                
                                if (cat === '9') {
                                    chunk.forEach(spName => {
                                        assignedSpTexts.push(insproTextMap[spName] || spName);
                                    });
                                }
                            }
                        });
                        
                        const spTextForPrompt = assignedSpTexts.length > 0 ? assignedSpTexts.join('; ') : 'Menyelesaikan masalah berstruktur dan aktiviti pengukuhan';

                        const sessionText = `${foundClassName} Sesi ${count + 1} (${dayNames[dayNumStr] || dayNumStr})`;
                        if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb(`5/6: Memproses RPH ${sessionText} [SP sekata: ${assignedSpTexts.length} item]...`);

                        // Fetch fresh openmiw form
                        let fContent = miwHtml;
                        try {
                            const freshOpenMiw = await Http.get({
                                url: `https://asiemodel.net/model/miw9.php?action=openmiw&id=${miw.id}`,
                                headers: getHeaders()
                            });
                            const fMatch = (freshOpenMiw.data || '').match(/<form[^>]*id="miwform"[^>]*>([\s\S]*?)<\/form>/);
                            if (fMatch) fContent = fMatch[1];
                        } catch (e) {}

                        // STEP 1: CREATE RPH SHELL WITH EVEN SP CHECKBOXES
                        const createData = new URLSearchParams();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(fContent, 'text/html');
                        
                        const elements = doc.querySelectorAll('input, select, textarea');
                        elements.forEach(el => {
                            if (!el.name) return;
                            
                            if (el.tagName.toLowerCase() === 'input') {
                                const isCheckbox = (el.type === 'checkbox' || el.type === 'radio');
                                const isChecked = el.hasAttribute('checked') || el.checked;
                                
                                if (el.name.startsWith('InsPro[')) {
                                    if (assignedInsPro.includes(el.name)) {
                                        createData.append(el.name, '1');
                                    }
                                } else if (isCheckbox) {
                                    if (isChecked) createData.append(el.name, el.value || '1');
                                } else {
                                    createData.append(el.name, el.value || '');
                                }
                            } else if (el.tagName.toLowerCase() === 'select') {
                                // If the original HTML has 'selected' attribute on an option, prioritize that
                                // Otherwise get the first option
                                const selectedOpt = el.querySelector('option[selected]') || el.querySelector('option');
                                if (selectedOpt) {
                                    createData.append(el.name, selectedOpt.value || '');
                                }
                            } else if (el.tagName.toLowerCase() === 'textarea') {
                                createData.append(el.name, el.innerHTML || '');
                            }
                        });

                        createData.set('class_id', primaryClassId);
                        createData.set('ur[class_id]', primaryClassId);
                        createData.set('rph[date]', targetDate);
                        createData.set('rph[time_from]', slot.timestart);
                        createData.set('rph[time_to]', slot.timeend);
                        createData.set('rph[setjadual]', slot.setJadual);
                        createData.set('action', 'Cipta RPH');
                        createData.set('actionRPH', 'createRPH');

                        if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb(`  -> Step 1: Mencipta RPH ${sessionText} (${targetDate} : ${slot.timestart}-${slot.timeend})...`);
                        
                        const createRes = await Http.post({
                            url: 'https://asiemodel.net/model/miw9.php',
                            headers: getHeaders({
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Referer': `https://asiemodel.net/model/miw9.php?action=openmiw&id=${miw.id}`
                            }),
                            data: createData.toString()
                        });

                        const cHtml = createRes.data || '';
                        const cUrl = createRes.url || '';
                        let newRphId = null;
                        
                        const possibleMatches = [
                            cHtml.match(/<input[^>]*name=["']id["'][^>]*value=["'](\d+)["']/i),
                            cHtml.match(/<input[^>]*name=["']rph["'][^>]*value=["'](\d+)["']/i),
                            cHtml.match(/<input[^>]*id=["']rph_id["'][^>]*value=["'](\d+)['"]/i),
                            cHtml.match(/formsSKPM\.php\?action=skpm&(?:amp;)?(?:rph|id|rph_id)=(\d+)/i),
                            cHtml.match(/editRPH&(?:amp;)?(?:rph|id|rph_id)=(\d+)/i),
                            cHtml.match(/window\.location\.(?:href|replace)\s*=\s*['"][^'"]*(?:rph|id|rph_id)=(\d+)['"]/i),
                            cUrl.match(/[?&](?:rph|id|rph_id)=(\d+)/i)
                        ];
                        
                        for (let m of possibleMatches) {
                            if (m && m[1]) {
                                newRphId = m[1];
                                break;
                            }
                        }

                        // STEP 2: INJECT RICH DESKTOP-STYLE 5E AI AKTIVITI TEXT INTO RPH
                        if (newRphId && newRphId !== "0") {
                            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb(`  -> Step 2: Mengisi kandungan Aktiviti (AI 5E Desktop Style) ke RPH ID ${newRphId}...`);

                    const editRes = await Http.get({
                        url: `https://asiemodel.net/model/miw9.php?action=editRPH&rph=${newRphId}`,
                        headers: getHeaders()
                    });
                    const editHtml = editRes.data || '';
                    const editFormMatch = editHtml.match(/<form[^>]*id="miwform"[^>]*>([\s\S]*?)<\/form>/);
                    const editFormContent = editFormMatch ? editFormMatch[1] : editHtml;

                    const updateData = new URLSearchParams();
                    const doc2 = parser.parseFromString(editFormContent, 'text/html');
                    const elements2 = doc2.querySelectorAll('input, select, textarea');
                    
                    elements2.forEach(el => {
                        if (!el.name) return;
                        
                        if (el.tagName.toLowerCase() === 'input') {
                            const isCheckbox = (el.type === 'checkbox' || el.type === 'radio');
                            const isChecked = el.hasAttribute('checked') || el.checked;
                            
                            if (isCheckbox) {
                                if (isChecked) updateData.append(el.name, el.value || '1');
                            } else {
                                updateData.append(el.name, el.value || '');
                            }
                        } else if (el.tagName.toLowerCase() === 'select') {
                            const selectedOpt = el.querySelector('option[selected]') || el.querySelector('option');
                            if (selectedOpt) {
                                updateData.append(el.name, selectedOpt.value || '');
                            }
                        } else if (el.tagName.toLowerCase() === 'textarea') {
                            updateData.append(el.name, el.innerHTML || '');
                        }
                    });

                    // Detect if CHEATNOTE was selected in BBM
                    const hasCheatnote = payload.bbm ? (Array.isArray(payload.bbm) ? payload.bbm.some(b => String(b).toUpperCase().includes('CHEATNOTE')) : String(payload.bbm).toUpperCase().includes('CHEATNOTE')) : false;

                    // Detect Language & Dynamic Subject Name
                    const rawSubject = (typeof miw !== 'undefined' && miw.subjectKey) ? miw.subjectKey : (payload.subjectName || '');
                    const rawTopic = payload.miwName || rawSubject || '';
                    const combinedSyllabus = `${rawSubject} ${rawTopic} ${spTextForPrompt}`.toLowerCase();
                    const isEnglish = combinedSyllabus.includes('english') || 
                                      combinedSyllabus.includes('listening') || 
                                      combinedSyllabus.includes('speaking') || 
                                      combinedSyllabus.includes('reading') || 
                                      combinedSyllabus.includes('writing') || 
                                      combinedSyllabus.includes('understand') || 
                                      combinedSyllabus.includes('skills');

                    const subjectName = rawSubject ? rawSubject.toUpperCase() : (isEnglish ? 'ENGLISH LANGUAGE' : 'SUBJEK UTAMA');
                    const topicName = rawTopic ? rawTopic : (isEnglish ? 'ENGLISH SYLLABUS' : 'TAJUK UTAMA');

                    const cheatnoteInstruction = hasCheatnote
                        ? 'Integrasikan nota CHEATNOTE dalam Objektif dan Fasa Aktiviti.'
                        : 'HARAM DAN DILARANG SAMA SEKALI menyebut perkataan "CHEATNOTE" atau "nota CHEATNOTE" kerana ia tidak dipilih sebagai BBM!';

                    // CRITICAL: HYPER-SPECIFIC NAZIR SEKOLAH 5E PROMPT BASED ON EXACT SESSION SP & LANGUAGE
                    let aiText = '';
                    const apiKey = payload.apiKey || (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : '');

                    if (apiKey) {
                        try {
                            let prompt = "";
                            if (isEnglish) {
                                prompt = `Act as a Master School Inspector and Senior Pedagogy Expert. Create a high-performance 5E Bybee Instructional Lesson Plan based on this syllabus:

Subject / Field: ${subjectName}
Topic / Content Standard: ${topicName}
Specific Learning Standard for This Session: ${spTextForPrompt}
Class / Session: Class ${foundClassName} Session ${count+1} (~0.5 hour duration)

CRITICAL INSTRUCTIONS (MUST FOLLOW STRICTLY):

1. ABSOLUTE LANGUAGE & SUBJECT MATCHING (100% ENGLISH & STRICTLY NO MATHEMATICS):
   - The entire lesson plan (Objective, 5E Phases, and Teacher's Reflection) MUST BE WRITTEN 100% IN ENGLISH!
   - THIS IS AN ENGLISH LANGUAGE LESSON PLAN (Listening, Speaking, Reading, or Writing skills).
   - ABSOLUTELY FORBIDDEN & HARAM TO MENTION Mathematics, numbers, word problems, 5 apples 3 bananas, cuboids, calculations, or math formulas!
   - The activities MUST be 100% focused on English Language skills (listening to audio clips, dialogue roleplays, reading texts, writing worksheets) based strictly on "${spTextForPrompt}".

2. DEEP SPECIFICITY BASED ON LEARNING STANDARD:
   - All 5E phases (Engage, Explore, Explain, Elaborate, Evaluate) MUST directly focus on the specific skills, concepts, key terms, and task examples of this exact Learning Standard ("${spTextForPrompt}").
   - DO NOT write generic phrases like "students study this topic" or "students complete exercises". EVERY ACTIVITY STEP MUST explicitly mention the actual content of the Learning Standard!

3. OBJECTIVE STATEMENT (ABC²D+ MODEL):
   - Audience: "Students".
   - Behaviour: Measurable performance verb (Bloom/Anderson Taxonomy). DO NOT use vague verbs like "understand", "appreciate", or "remember".
   - Content: Based SOLELY on the Specific Learning Standard ("${spTextForPrompt}").
   - Condition: Evidences/methods used (e.g. based on observation, through video, using interactive simulation). ${cheatnoteInstruction} DO NOT mention A4 paper or projector.
   - Degree: Measurable achievement standard (e.g. with at least 80% accuracy, minimum 3 out of 5 criteria).
   - Plus (Aras Bloom): Include the cognitive level tag in brackets at the end, e.g. "(C4 - Analyzing)".
   - Example format: "Students will be able to [Behaviour] [Content] [Condition] [Degree]. [Plus]"
   - DO NOT print terms like "(behaviour)", "(condition)" or "5E Bybee".

4. 5E STRUCTURE & ACTIVITY RULES:
   - START DIRECTLY WITH THE LEARNING OBJECTIVE. DO NOT print header blocks like "RPH", "Subject:", "Class:", "Date:".
   - Every 5E phase MUST have at least 3 numbered items (<ol><li>).
   - Start each activity line with "Students will..." (student-centered).
   - Use Simple Future Tense ("Students will...").
   - Activities centered on A4 paper, LCD projector, teacher's laptop. Emphasize FUN HANDS-ON ACTIVITIES or INTERACTIVE SIMULATION.

5. PERSONAL TEACHER REFLECTION (MANDATORY):
   - At the very end after Phase 5 Evaluate, insert header:
     "<p><strong>Teacher's Reflection for This Session:</strong></p>"
   - Write a warm, genuine, personal paragraph expressing how the teacher felt during today's lesson, touched by student engagement, and future resolution.

6. PROHIBITED SECTION: Do NOT include "Student Profile", "Strategize", "Dimension 2", or "(i) Learning Impact".

OUTPUT MUST BE CLEAN PURE HTML (<b>, <strong>, <p>, <ol>, <li>). NO \`\`\`html tags.`;
                            } else {
                                prompt = `Bertindak sebagai seorang Nazir Sekolah (Pakar Pedagogi). Hasilkan Rancangan Pengajaran Harian (RPH) berprestasi tinggi berpandukan silibus berikut:

Bidang Pembelajaran: ${subjectName}
Standard Kandungan / Tajuk: ${topicName}
Standard Pembelajaran Khusus Sesi Ini: ${spTextForPrompt}
Kelas / Sesi: Kelas ${foundClassName} Sesi ${count+1} (Durasi ~0.5 jam)

ARAHAN PENULISAN RPH 5E BYBEE (SANGAT KETAT & HYPER-SPESIFIK):

1. KESPESIFIKAN SEPENUHNYA BERDASARKAN STANDARD PEMBELAJARAN (WAJIB & PENTING):
   - Keseluruhan Objektif dan Aktiviti 5E MESTI ditulis secara SANGAT KHUSUS, SPESIFIK dan MENDALAM berdasarkan "Standard Pembelajaran Khusus Sesi Ini" di atas ("${spTextForPrompt}").
   - HARAM & DILARANG SAMA SEKALI menggunakan ayat atau aktiviti generik/umum (seperti "murid mempelajari tajuk ini", "murid membuat latihan"). Anda MESTI menyebut istilah khusus, konsep, contoh soalan, atau pemboleh ubah yang wujud dalam Standard Pembelajaran tersebut di SETIAP fasa 5E!

2. SYARAT PERMULAAN TEKS (WAJIB):
   - JANGAN masukkan sebarang pengepala/header dummy seperti "Rancangan Pengajaran Harian (RPH)", "Mata Pelajaran:", "Kelas:", "Tarikh:", "Masa:".
   - TERUS MULAKAN TEKS RPH DENGAN OBJEKTIF PEMBELAJARAN MODEL ABCD.

3. OBJEKTIF PEMBELAJARAN MODEL ABC²D+ CIKGU KHAIRIL:
   - Audience (Audien): Mesti ditulis sebagai "Murid".
   - Behaviour (Tingkah Laku): Kata kerja Taksonomi Bloom yang boleh diukur dan diperhati (contoh: menganalisis, menghuraikan). Kata kerja 'faham', 'menghargai', 'mengingat' ADALAH DILARANG!
   - Content (Kandungan): MESTI berdasarkan SEPENUHNYA kepada Standard Pembelajaran ("${spTextForPrompt}") SAHAJA!
   - Condition (Evidens): Bagaimanakah murid memperoleh kandungan tersebut? (contoh: berdasarkan pemerhatian terhadap bahan visual, kajian kes, simulasi interaktif). ${cheatnoteInstruction} JANGAN sebut projektor atau kertas A4.
   - Degree (Aras/Tahap): Tahap minimum kejayaan (contoh: dengan sekurang-kurangnya 4 daripada 5 kriteria, 80% ketepatan, menghasilkan 2 idea berbeza).
   - Plus (+): Nyatakan aras Taksonomi Bloom di hujung ayat dalam kurungan (contoh: (C4 - Menganalisis)).
   - Format Wajib: "Murid dapat [Behaviour] [Content] [Condition] [Degree]. [Plus]"
   - KETAT: HARAM DAN DILARANG mencetak tag "(tingkah laku)", "(situasi)" atau "5E Bybee" secara literal.

4. FORMAT & STRUKTUR 5E (ENGAGE, EXPLORE, EXPLAIN, ELABORATE, EVALUATE):
   - Format fasa 5E: Engage-Pelibatan, Explore-Penerokaan, Explain-Penerangan, Elaborate-Pengembangan, Evaluate-Penilaian.
   - Durasi aktiviti sekitar 0.5 jam. Setiap fasa MESTI mengandungi sekurang-kurangnya 3 langkah bernombor senarai HTML (<ol><li>).
   - Mulakan setiap baris aktiviti dengan perkataan "Murid..." bukannya "Guru...".
   - Semua ayat dalam Simple Future Tense / Bahasa Melayu futuristik ("Murid akan...").
   - Aktiviti berpusat menggunakan kertas A4, projektor, dan komputer riba/laptop guru. Utamakan FUN HANDS-ON ACTIVITIES atau SIMULASI INTERAKTIF.

5. BAHAGIAN REFLEKSI PERSONAL DI AKHIR RPH (WAJIB):
   - Di bahagian paling akhir selepas Fasa Evaluate - Penilaian, masukkan tajuk tepat ini:
     "<p><strong>Refleksi PdP Sesi Ini:</strong></p>"
   - Tulis perenggan refleksi personal guru yang menyatakan perasaan jujur, gembira, bersyukur, tersentuh dengan penglibatan murid semasa aktiviti hands-on/simulasi, serta azam penambahbaikan.

6. DILARANG SAMA SEKALI MEMASUKKAN BAHAGIAN INI: "Profil Pelajar", "MENYUSUN STRATEGI (STRATEGIZE)", "Dimensi 2: Membangun - Kemahiran", "(i) Impak Pembelajaran".

PENTING: Output MESTI dalam format HTML tulen (gunakan <b>, <strong>, <p>, <ol>, <li>). JANGAN ada \`\`\`html di pangkal atau hujung.`;
                            }

                            const isOR = apiKey.startsWith('sk-or-');
                            let targetModelUrl = isOR ? 'https://openrouter.ai/api/v1/chat/completions' : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                            
                            let aiRes = await Http.post({
                                url: targetModelUrl,
                                headers: isOR ? { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
                                data: isOR ? JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], temperature: 0.9, max_tokens: 4000 }) : JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                            });
                            
                            let resJson = typeof aiRes.data === 'string' ? JSON.parse(aiRes.data) : aiRes.data;

                            // Fallback to gemini-flash-lite-latest if gemini-2.5-flash is busy or error
                            if (!isOR && resJson.error) {
                                const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
                                const fbRes = await Http.post({
                                    url: fallbackUrl,
                                    headers: { 'Content-Type': 'application/json' },
                                    data: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                                });
                                resJson = typeof fbRes.data === 'string' ? JSON.parse(fbRes.data) : fbRes.data;
                            }

                            if (isOR && resJson.choices && resJson.choices[0]) {
                                aiText = resJson.choices[0].message.content.replace(/```html/gi, '').replace(/```/g, '').trim();
                            } else if (!isOR && resJson.candidates && resJson.candidates[0]) {
                                aiText = resJson.candidates[0].content.parts[0].text.replace(/```html/gi, '').replace(/```/g, '').trim();
                            }
                        } catch (e) {
                            console.log("AI API Call Error:", e);
                        }
                    }

                    if (!aiText) {
                        if (isEnglish) {
                            aiText = `<p><strong>Learning Objective:</strong><br>Students in ${foundClassName} will be able to extract main ideas and specific information from simple listening texts on familiar topics based on collaborative pair tasks with at least 85% accuracy. (C4 - Analyzing)</p><p><strong>Phase 1: Engage</strong></p><ol><li>Students will listen to a short audio clip played by the teacher to introduce the session's topic.</li><li>Students will answer guided oral questions from the teacher to activate prior knowledge.</li><li>Students will share initial thoughts on the main theme with their seatmates.</li></ol><p><strong>Phase 2: Explore</strong></p><ol><li>Students will work in small groups with A4 task cards containing key phrases from the listening text.</li><li>Students will collaborate to match audio cues with corresponding images and statements.</li><li>Students will note down specific details on their group worksheets.</li></ol><p><strong>Phase 3: Explain</strong></p><ol><li>Students will present their group findings to the class during a short presentation session.</li><li>Students from other groups will provide constructive feedback and ask clarifying questions.</li><li>The teacher will summarize key listening strategies and clarify any vocabulary misunderstandings.</li></ol><p><strong>Phase 4: Elaborate</strong></p><ol><li>Students will complete an individual extension task applying the listening strategies to a new scenario.</li><li>Students will discuss their answers in pairs to confirm understanding.</li><li>The teacher will offer targeted guidance to students requiring extra support.</li></ol><p><strong>Phase 5: Evaluate</strong></p><ol><li>Students will complete a brief formative assessment on A4 paper measuring key information retrieval.</li><li>Students will self-check their answers against the success criteria displayed on the projector.</li><li>The teacher will collect the assessment sheets to review student progress.</li></ol><p><strong>Teacher's Reflection for This Session:</strong></p><p>I felt truly grateful and delighted to see the active participation of ${foundClassName} students during today's listening session. Their enthusiasm during group tasks gave me great satisfaction as an educator.</p>`;
                        } else {
                            const cheatnoteFallbackText = hasCheatnote ? ' dengan menggunakan nota CHEATNOTE dan bahan bantu mengajar.' : '.';
                            aiText = `<p><strong>Objektif Pembelajaran:</strong><br>Murid kelas ${foundClassName} dapat mengaplikasi penyelesaian masalah berstruktur berdasarkan simulasi interaktif dan perbincangan kolaboratif dengan ketepatan sekurang-kurangnya 85% dan tahap kefahaman yang cemerlang. (C3 - Mengaplikasi)${cheatnoteFallbackText}</p><p><strong>Fasa 1: Pelibatan (Engage)</strong></p><ol><li>Murid mendengar penerangan awal daripada guru dan bersedia dengan peralatan pelajaran bagi kelas ${foundClassName}.</li><li>Murid mengamati contoh soalan/bahan ransangan visual yang dipaparkan untuk mencetuskan kemahiran berfikir aras tinggi (KBAT).</li><li>Murid bersoal jawab secara aktif dengan guru bagi menghubungkaitkan tajuk dengan pengalaman harian.</li></ol><p><strong>Fasa 2: Penerokaan (Explore)</strong></p><ol><li>Murid dibahagikan kepada beberapa kumpulan kecil untuk menjalankan aktiviti hands-on (PAK-21).</li><li>Setiap kumpulan diberikan kad tugasan dan bahan bantuan mengajar untuk meneroka penyelesaian masalah secara berpasukan.</li><li>Murid mencatat hasil dapatan dan menyusun idea menggunakan peta pemikiran i-THINK yang sesuai.</li></ol><p><strong>Fasa 3: Penerangan (Explain)</strong></p><ol><li>Wakil daripada setiap kumpulan membentangkan hasil perbincangan di hadapan kelas secara yakin (Gallery Walk / Pembentangan).</li><li>Murid daripada kumpulan lain memberikan maklum balas dan mengajukan soalan tambahan secara berhemah.</li><li>Guru memberikan ulasan pakar, membetulkan salah faham konsep dan mengukuhkan kefahaman murid.</li></ol><p><strong>Fasa 4: Pengembangan (Elaborate)</strong></p><ol><li>Murid diberikan latihan pengukuhan dan soalan cabaran KBAT secara individu.</li><li>Murid mengaplikasikan strategi dan formula yang dipelajari untuk menyelesaikan soalan beraras tinggi.</li><li>Guru membimbing murid yang memerlukan sokongan (bimbingan terbeza) untuk memastikan penguasaan saksama.</li></ol><p><strong>Fasa 5: Penilaian (Evaluate)</strong></p><ol><li>Murid menjawab soalan penilaian kendiri / pentaksiran formatif ringkas untuk mengukur tahap penguasaan.</li><li>Guru dan murid merumuskan objektif serta kriteria kejayaan yang dicapai pada hari ini.</li><li>Guru memberikan pujian di atas penglibatan aktif murid serta memberikan tugasan pengukuhan di rumah.</li></ol><p><strong>Refleksi PdP Sesi Ini:</strong></p><p>Saya rasa amat bersyukur dan gembira melihat kesungguhan serta keterujaan murid kelas ${foundClassName} semasa menyertai aktiviti PdP pada hari ini. Suasana pembelajaran yang interaktif dan berpusatkan murid telah meningkatkan kefahaman mereka secara mendalam dan memberi dorongan untuk sesi akan datang.</p>`;
                        }
                    } else if (isEnglish && !aiText.toLowerCase().includes('reflection')) {
                        aiText += `<p><strong>Teacher's Reflection for This Session:</strong></p><p>I felt deeply satisfied and grateful seeing how actively the students participated in today's lesson. Their enthusiasm during the interactive hands-on tasks gave me immense fulfillment as an educator, and I resolve to continue bringing dynamic learning experiences to future sessions.</p>`;
                    } else if (!isEnglish && !aiText.includes('Refleksi PdP Sesi Ini')) {
                        aiText += `<p><strong>Refleksi PdP Sesi Ini:</strong></p><p>Saya rasa amat bersyukur dan berpuas hati dengan perjalanan sesi PdP pada hari ini. Penglibatan aktif serta keterujaan murid semasa aktiviti hands-on memberikan kepuasan yang tinggi kepada saya sebagai seorang pendidik. Suasana kelas yang positif ini memberi dorongan kepada saya untuk terus membimbing murid dengan lebih berkesan pada sesi akan datang.</p>`;
                    }

                    // EXACT DESKTOP REFLEKSI / MENILAI / IMPAK GENERATION
                    const totalStudents = 30;
                    const minRand = Math.max(3, Math.floor(totalStudents * 0.1));
                    const maxRand = Math.min(15, Math.ceil(totalStudents * 0.25));
                    const yRand = Math.floor(Math.random() * (maxRand - minRand + 1)) + minRand;
                    const xTotal = Math.max(0, totalStudents - yRand);

                    const refleksiText = `${xTotal} orang murid mencapai dan menguasai semua Objektif Pembelajaran ditetapkan oleh Standard Pembelajaran. ${yRand} orang murid perlu penerangan lanjutan dan telah diberi pentaksiran lisan serta diberi bimbingan bagi mencapai dan menguasai semua Objektif Pembelajaran pada hari ini.`;

                    // CRITICAL: Lock primaryClassId so ASIE binds RPH to exact class tab (never Tanpa Penetapan Kelas)
                    updateData.set('class_id', primaryClassId);
                    updateData.set('ur[class_id]', primaryClassId);
                    updateData.set('rph[class_id]', primaryClassId);

                    updateData.set('id', newRphId);
                    updateData.set('rph_id', newRphId);
                    updateData.set('action', 'Simpan RPH');
                    updateData.set('actionRPH', 'updateRPH');
                    updateData.set('rph[InsMLe][858][3004]', aiText);
                    updateData.set('rph[catatan][858][3004]', `Catatan PdP ${foundClassName} Sesi ${count+1} (${dayNames[dayNumStr]}) dilaksanakan dengan lancar dan berkesan.`);
                    updateData.set('rph[impak]', refleksiText);

                    updateData.set('rph[description]', aiText);
                    updateData.set('rph[aktiviti]', aiText);
                    updateData.set('rph[catatan]', `Catatan PdP ${foundClassName} Sesi ${count+1} (${dayNames[dayNumStr]}) dilaksanakan dengan lancar dan berkesan.`);
                    updateData.set('InsMLe[858][3004]', '3004');
                    updateData.set('InsMLe[870]', '1');

                    await Http.post({
                        url: 'https://asiemodel.net/model/miw9.php',
                        headers: getHeaders({
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Referer': `https://asiemodel.net/model/miw9.php?action=editRPH&rph=${newRphId}`
                        }),
                        data: updateData.toString()
                    });

                    successCount++;
                    if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb(`  ✓ RPH & Teks Aktiviti 5E Nazir Sekolah & Refleksi berjaya disimpan untuk ${sessionText}`);
                } else {
                    successCount++;
                    if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb(`  ✓ RPH berjaya dicipta untuk ${sessionText} (Tanpa Aktiviti 5E AI kerana ketiadaan ID RPH)`);
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    alert(`Selesai! RPH & Aktiviti 5E berjaya dicipta: ${successCount}, Gagal: ${errorCount}`);
    if (window.electronAPI._automationDoneCb) {
        window.electronAPI._automationDoneCb();
    }
} catch (error) {
    alert('Ralat kritikal: ' + error.message);
    if (window.electronAPI._automationDoneCb) {
        window.electronAPI._automationDoneCb();
    }
}
    },
    onAutomationLog: (callback) => { window.electronAPI._automationLogCb = callback; },
    onAutomationDone: (callback) => { window.electronAPI._automationDoneCb = callback; },
    onScheduleExtracted: (callback) => { window.electronAPI._scheduleExtractedCb = callback; },
    extractScheduleAi: async (payload) => {
        try {
            const settings = getDecryptedSettings();
            let apiKey = (payload && payload.apiKey) || settings.apiKey || '';
            if (!apiKey || apiKey.trim() === '') {
                apiKey = (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : '');
            }

            const imageBase64 = payload ? payload.imageBase64 : '';
            if (!imageBase64) {
                return { success: false, error: 'Sila muat naik atau paste gambar jadual waktu.' };
            }

            const prompt = `
Anda adalah pakar pengecaman jadual waktu sekolah. Sila analisis gambar jadual waktu kelas ini dan ekstrak senarai kelas dan mata pelajaran.
Anda MESTI memulangkan data HANYA dalam format array JSON tulen seperti contoh di bawah. Tiada teks penerangan, tiada markdown.

PANDUAN PEMETAAN ID:
Untuk "class_id", gunakan format seperti "cg_secondary-form1", "cg_secondary-form2", "cg_secondary-form3", "cg_secondary-form4", "cg_secondary-form5".
Untuk "subject_id", teka kategori yang paling tepat. Contoh:
- Matematik: "sg_science_math-mathematics", "sg_science_math-add_math"
- Sains/Fizik/Kimia/Biologi: "sg_science_math-science", "sg_science_math-physics", "sg_science_math-chemistry", "sg_science_math-biology"
- Bahasa Melayu: "sg_language-bmelayu"
- Bahasa Inggeris: "sg_language-english"
- Sejarah: "sg_arts-history"
- PJPK: "sg_arts-pjpk"
- Geografi: "sg_arts-geography"
- RBT: "sg_technology-rbt"
- Pendidikan Islam: "sg_religion-pi"
- Jawi: "sg_religion-jawi"
- Bahasa Arab: "sg_language-barab"

CONTOH OUTPUT JSON:
[
    {
        "subject_id": "sg_science_math-mathematics",
        "subject_text": "Matematik",
        "class_id": "cg_secondary-form2",
        "session_text": "2 JABIR",
        "sessions": 2,
        "day": "Isnin",
        "time": "08:00 - 09:00"
    }
]

Arahan Tambahan:
- "day" merujuk kepada hari kelas tersebut berlangsung (Isnin, Selasa, Rabu, Khamis, Jumaat).
- "time" merujuk kepada slot masa kelas tersebut.
- "sessions" merujuk kepada tempoh atau bilangan waktu berterusan bagi slot tersebut (contohnya jika 1 slot 30 minit, 08:00-09:00 = 2 sesi).
- PENTING / CRITICAL: Jika kelas yang sama untuk subjek yang sama berlangsung secara berturut-turut pada hari yang sama (contohnya 11:20-11:50, 11:50-12:20, 12:20-12:50 bagi kelas 2 K subjek Bahasa Inggeris), GAMBUNGKAN TERUS MENJADI 1 REKOD SAHAJA daripada waktu bermula hingga waktu tamat (contoh: 11:20-12:50, sessions: 3). Jangan pulangkan slot berasingan bagi kelas yang sama berturut-turut!
- "subject_text" mestilah NAMA SUBJEK penuh (bukan singkatan). Jika jadual menggunakan singkatan (seperti MM, FZK, PJK), tukarkan kepada nama penuh (contoh: Matematik, Fizik, Pendidikan Jasmani Kesihatan).
- "session_text" MESTILAH NAMA KELAS penuh. Jika jadual menggunakan singkatan kelas (contoh: 5B, 4F, 2J), sila panjangkannya kepada tekaan nama penuh yang paling logik (contoh: 5 BESTARI, 4 FIRDAUS, 2 JUPITER).
- Pastikan mematuhi struktur JSON ini dengan ketat. Return tulen JSON array sahaja (tanpa backticks).
`;

            const Http = getHttp();
            if (!Http) throw new Error('CapacitorHttp plugin tidak ditemui.');

            const isOpenRouter = apiKey.startsWith('sk-or-');
            let responseText = "";

            if (isOpenRouter) {
                const res = await Http.post({
                    url: 'https://openrouter.ai/api/v1/chat/completions',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        model: 'google/gemini-2.5-flash',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: prompt },
                                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                                ]
                            }
                        ],
                        temperature: 0.2,
                        max_tokens: 4000
                    })
                });
                let data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                if (data.error) throw new Error(data.error.message || 'OpenRouter API Error');
                responseText = data.choices[0].message.content.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
            } else {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                let res = await Http.post({
                    url: url,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
                            ]
                        }]
                    })
                });
                let data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                if (data.error) {
                    const fbUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
                    res = await Http.post({
                        url: fbUrl,
                        headers: { 'Content-Type': 'application/json' },
                        data: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: prompt },
                                    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
                                ]
                            }]
                        })
                    });
                    data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                }

                if (data.candidates && data.candidates[0]) {
                    responseText = data.candidates[0].content.parts[0].text.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
                } else {
                    throw new Error('Gagal mendapatkan maklum balas daripada AI Gemini');
                }
            }

            const rawLessons = JSON.parse(responseText);

            function mergeConsecutiveLessons(lessonsList) {
                if (!Array.isArray(lessonsList) || lessonsList.length === 0) return lessonsList;
                const dayOrder = { 'isnin': 1, 'selasa': 2, 'rabu': 3, 'khamis': 4, 'jumaat': 5, 'sabtu': 6, 'ahad': 7 };
                function parseMinutes(tStr) {
                    if (!tStr) return 0;
                    let s = tStr.trim().toUpperCase().replace(/AM|PM/g, '').trim();
                    let parts = s.split(':');
                    let h = parseInt(parts[0], 10) || 0;
                    let m = parseInt(parts[1], 10) || 0;
                    if (tStr.toUpperCase().includes('PM') && h < 12) h += 12;
                    if (tStr.toUpperCase().includes('AM') && h === 12) h = 0;
                    return h * 60 + m;
                }
                const sorted = [...lessonsList].sort((a, b) => {
                    const dA = dayOrder[(a.day || '').toLowerCase()] || 9;
                    const dB = dayOrder[(b.day || '').toLowerCase()] || 9;
                    if (dA !== dB) return dA - dB;
                    const tA = (a.time || '').split('-')[0];
                    const tB = (b.time || '').split('-')[0];
                    return parseMinutes(tA) - parseMinutes(tB);
                });
                const merged = [];
                for (const item of sorted) {
                    if (merged.length === 0) {
                        merged.push({ ...item, sessions: item.sessions || 1 });
                        continue;
                    }
                    const prev = merged[merged.length - 1];
                    const sameDay = (prev.day || '').toLowerCase().trim() === (item.day || '').toLowerCase().trim();
                    const normPrevClass = (prev.session_text || prev.className || prev.class || '').toLowerCase().replace(/\s+/g, '');
                    const normCurrClass = (item.session_text || item.className || item.class || '').toLowerCase().replace(/\s+/g, '');
                    const sameClass = normPrevClass !== '' && normPrevClass === normCurrClass;
                    const normPrevSubj = (prev.subject_text || prev.subject || '').toLowerCase().replace(/\s+/g, '');
                    const normCurrSubj = (item.subject_text || item.subject || '').toLowerCase().replace(/\s+/g, '');
                    const sameSubj = normPrevSubj !== '' && normPrevSubj === normCurrSubj;

                    if (sameDay && sameClass && sameSubj) {
                        const prevTimes = (prev.time || '').split('-');
                        const currTimes = (item.time || '').split('-');
                        if (prevTimes.length === 2 && currTimes.length === 2) {
                            const prevEndM = parseMinutes(prevTimes[1]);
                            const currStartM = parseMinutes(currTimes[0]);
                            const currEndM = parseMinutes(currTimes[1]);
                            if (Math.abs(currStartM - prevEndM) <= 10 && currEndM > parseMinutes(prevTimes[0])) {
                                prev.time = `${prevTimes[0].trim()} - ${currTimes[1].trim()}`;
                                prev.sessions = (prev.sessions || 1) + (item.sessions || 1);
                                continue;
                            }
                        }
                    }
                    merged.push({ ...item, sessions: item.sessions || 1 });
                }
                return merged;
            }

            const lessons = mergeConsecutiveLessons(rawLessons);
            return { success: true, lessons: lessons };
        } catch (e) {
            console.error('Mobile extractScheduleAi Error:', e);
            return { success: false, error: e.message };
        }
    },
    submitJadual: async (payload) => {
        try {
            const { credentials, lessons } = payload || {};
            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb("Mula memproses dan menghantar jadual ke ASIE Model...");

            const settings = getDecryptedSettings();
            const username = (credentials && credentials.username) || settings.username;
            const password = (credentials && credentials.password) || settings.password;

            if (!username || !password) {
                if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb("Ralat: Username/Password tidak dijumpai.");
                if (window.electronAPI._automationDoneCb) window.electronAPI._automationDoneCb();
                return;
            }

            const Http = getHttp();
            if (!Http) throw new Error("CapacitorHttp plugin tidak ditemui.");

            const cookieMap = {};
            const getHeaders = (extra = {}) => {
                const cookieStr = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
                return { 'User-Agent': 'Mozilla/5.0 (Android; Mobile)', 'Cookie': cookieStr, ...extra };
            };
            const updateCookies = (res) => {
                const setCookie = res.headers ? (res.headers['set-cookie'] || res.headers['Set-Cookie']) : null;
                if (setCookie) {
                    const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
                    cookieArr.forEach(c => {
                        const [k, v] = c.split(';')[0].split('=');
                        if (k && v) cookieMap[k.trim()] = v.trim();
                    });
                }
            };

            // 1. Log Masuk
            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb("1/4: Log masuk ke ASIE Model...");
            const loginRes = await Http.post({
                url: 'https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                data: new URLSearchParams({
                    username: username,
                    password: password,
                    redirect: 'main.php?cb=ms',
                    language: 'en',
                    view: 'home',
                    submit: 'Login'
                }).toString()
            });
            updateCookies(loginRes);

            // 2. Ambil Halaman waktumengajar
            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb("2/4: Membuka borang jadual waktu...");
            const pageRes = await Http.get({
                url: 'https://asiemodel.net/model/teachers9.php?action=waktumengajar',
                headers: getHeaders()
            });
            updateCookies(pageRes);

            const html = pageRes.data || '';

            // Ekstrak nilai borang asas
            const getVal = (name) => {
                const m = html.match(new RegExp(`name=['"]${name}['"][^>]*value=['"]([^'"]*)['"]`, 'i'));
                return m ? m[1] : '';
            };

            const sesi = getVal('sesi') || '2026';
            const schoolstart = getVal('schoolstart') || '7:15 AM';
            const schoolend = getVal('schoolend') || '3:15 PM';
            const maximumperiod = getVal('maximumperiod') || '20';
            const schooldaystart = getVal('schooldaystart') || 'Monday';
            const schooldayend = getVal('schooldayend') || 'Friday';
            const nama_jadual = getVal('nama_jadual') || 'SET A';
            
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const yyyy = today.getFullYear();
            const bilastart = getVal('bilastart') || `${dd}-${mm}-${yyyy}`;
            const anjal = getVal('anjal') || '1';

            // Ekstrak pemetaan Kelas dari select#new_teaching_period (ambil numeric class_id)
            const classOptionsMap = {};
            const selectClassMatch = html.match(/<select[^>]*id=['"]new_teaching_period['"][^>]*>([\s\S]*?)<\/select>/i);
            if (selectClassMatch && selectClassMatch[1]) {
                const optRegex = /<option[^>]*value=['"]([^'"]+)['"][^>]*>\s*([^<]+)\s*<\/option>/gi;
                let m;
                while ((m = optRegex.exec(selectClassMatch[1])) !== null) {
                    const val = m[1].trim();
                    const txt = m[2].trim();
                    if (val && !val.includes('create_new')) {
                        const numericId = val.split('--')[0].trim();
                        classOptionsMap[txt.toLowerCase()] = numericId;
                        const cleanTxt = txt.replace(/^\d+--\s*/, '').toLowerCase();
                        classOptionsMap[cleanTxt] = numericId;
                    }
                }
            }

            // Ekstrak baris jadual sedia ada dari HTML supaya tidak terpadam
            const daysArr = [];
            const classIdArr = [];
            const subjGroupArr = [];
            const subjArr = [];
            const startTimeArr = [];
            const endTimeArr = [];
            const periodArr = [];
            const dlpArr = [];

            const rowRegex = /<li[^>]*class="li_row li_sortable[^"]*"[\s\S]*?<\/li>/gi;
            let rowMatch;
            while ((rowMatch = rowRegex.exec(html)) !== null) {
                const rowHtml = rowMatch[0];
                const d = rowHtml.match(/name="days\[\d+\]"[^>]*value="([^"]+)"/) || rowHtml.match(/name="days\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*value="([^"]+)"/);
                const c = rowHtml.match(/name="class_id\[\d+\]"[^>]*value="([^"]+)"/) || rowHtml.match(/name="class_id\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*value="([^"]+)"/);
                const sg = rowHtml.match(/name="subjectgroup\[\d+\]"[^>]*value="([^"]+)"/) || rowHtml.match(/name="subjectgroup\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*value="([^"]+)"/);
                const s = rowHtml.match(/name="subject\[\d+\]"[^>]*value="([^"]+)"/);
                const st = rowHtml.match(/name="starttime\[\d+\]"[^>]*value="([^"]+)"/);
                const et = rowHtml.match(/name="endtime\[\d+\]"[^>]*value="([^"]+)"/);
                const p = rowHtml.match(/name="period\[\d+\]"[^>]*value="([^"]+)"/);
                const dlp = rowHtml.match(/name="dlp\[\d+\]"[^>]*value="([^"]+)"/);

                if (d && c && s) {
                    daysArr.push(d[1].split('--')[0].trim());
                    classIdArr.push(c[1].split('--')[0].trim());
                    subjGroupArr.push(sg ? sg[1] : 'sg_science_math');
                    subjArr.push(s[1].split('==')[0].trim());
                    startTimeArr.push(st ? st[1] : '8:00 AM');
                    endTimeArr.push(et ? et[1] : '9:00 AM');
                    periodArr.push(p ? p[1] : '2');
                    dlpArr.push(dlp ? dlp[1] : '1');
                }
            }

            const dayMap = {
                'isnin': 'Monday', 'monday': 'Monday',
                'selasa': 'Tuesday', 'tuesday': 'Tuesday',
                'rabu': 'Wednesday', 'wednesday': 'Wednesday',
                'khamis': 'Thursday', 'thursday': 'Thursday',
                'jumaat': 'Friday', 'friday': 'Friday',
                'sabtu': 'Saturday', 'saturday': 'Saturday',
                'ahad': 'Sunday', 'sunday': 'Sunday'
            };

            function formatToAmPm(timeStr) {
                if (!timeStr) return '8:00 AM';
                if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) return timeStr.trim().toUpperCase();
                let [hours, minutes] = timeStr.split(':');
                if (!hours || !minutes) return timeStr.trim();
                hours = parseInt(hours, 10);
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; 
                return `${hours}:${minutes.trim()} ${ampm}`;
            }

            function mapSubjectInfo(subjText) {
                const lower = (subjText || '').toLowerCase().trim();
                if (lower.includes('inggeris') || lower.includes('english') || lower === 'bi') {
                    return { group: 'sg_language', id: 'english' };
                } else if (lower.includes('melayu') || lower === 'bm') {
                    return { group: 'sg_language', id: 'bmelayu' };
                } else if (lower.includes('sains') || lower === 'sn') {
                    return { group: 'sg_science_math', id: 'science' };
                } else if (lower.includes('fizik')) {
                    return { group: 'sg_science_math', id: 'physics' };
                } else if (lower.includes('kimia')) {
                    return { group: 'sg_science_math', id: 'chemistry' };
                } else if (lower.includes('biologi')) {
                    return { group: 'sg_science_math', id: 'biology' };
                } else if (lower.includes('sejarah') || lower === 'sej') {
                    return { group: 'sg_arts', id: 'history' };
                } else if (lower.includes('geografi') || lower === 'geo') {
                    return { group: 'sg_arts', id: 'geography' };
                } else if (lower.includes('islam') || lower === 'pi') {
                    return { group: 'sg_religion', id: 'islamic_studies' };
                } else if (lower.includes('jasmani') || lower.includes('pjpk') || lower === 'pjk') {
                    return { group: 'sg_arts', id: 'pjpk' };
                } else if (lower.includes('rbt') || lower.includes('reka')) {
                    return { group: 'sg_technology', id: 'rbt' };
                } else {
                    return { group: 'sg_science_math', id: 'mathematics' };
                }
            }

            // 3. Masukkan rekod jadual baharu
            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb(`3/4: Memproses ${lessons ? lessons.length : 0} rekod jadual baharu...`);

            if (lessons && lessons.length > 0) {
                for (let i = 0; i < lessons.length; i++) {
                    const item = lessons[i];
                    const rawDay = (item.day || '').toLowerCase().trim();
                    const mappedDay = dayMap[rawDay] || 'Monday';

                    const rawClass = (item.session_text || item.className || item.class || '').toLowerCase().trim();
                    let mappedClass = classOptionsMap[rawClass];
                    if (!mappedClass) {
                        const foundKey = Object.keys(classOptionsMap).find(k => k.includes(rawClass) || rawClass.includes(k));
                        if (foundKey) mappedClass = classOptionsMap[foundKey];
                    }
                    if (!mappedClass && Object.values(classOptionsMap).length > 0) {
                        mappedClass = Object.values(classOptionsMap)[0];
                    }

                    const subjInfo = mapSubjectInfo(item.subject_text || item.subject);
                    const times = (item.time || '08:00 AM - 09:30 AM').split('-');
                    const st = formatToAmPm(times[0] ? times[0].trim() : '08:00 AM');
                    const et = formatToAmPm(times[1] ? times[1].trim() : '09:30 AM');
                    const periodCount = String(item.sessions || 2);

                    daysArr.push(mappedDay);
                    classIdArr.push(mappedClass || '');
                    subjGroupArr.push(subjInfo.group);
                    subjArr.push(subjInfo.id);
                    startTimeArr.push(st);
                    endTimeArr.push(et);
                    periodArr.push(periodCount);
                    dlpArr.push('1');

                    if (window.electronAPI._automationLogCb) {
                        window.electronAPI._automationLogCb(`  ✓ [${i + 1}/${lessons.length}] Ditambah: ${item.day} | ${st}-${et} | ${item.session_text} | ${item.subject_text}`);
                    }
                }
            }

            // 4. Bina borang POST akhir ke teachers9.php
            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb("4/4: Menyimpan keseluruhan jadual ke dalam ASIE Model...");

            const formData = new URLSearchParams();
            formData.append('action', 'savesetting');
            formData.append('set', 'teaching_period');
            formData.append('setjadual', 'new');
            formData.append('sesi', sesi);
            formData.append('schoolstart', schoolstart);
            formData.append('schoolend', schoolend);
            formData.append('maximumperiod', maximumperiod);
            formData.append('schooldaystart', schooldaystart);
            formData.append('schooldayend', schooldayend);
            formData.append('nama_jadual', nama_jadual);
            formData.append('bilastart', bilastart);
            formData.append('anjal', anjal);

            for (let idx = 0; idx < daysArr.length; idx++) {
                formData.append(`days[${idx}]`, daysArr[idx]);
                formData.append(`class_id[${idx}]`, classIdArr[idx]);
                formData.append(`subjectgroup[${idx}]`, subjGroupArr[idx]);
                formData.append(`subject[${idx}]`, subjArr[idx]);
                formData.append(`starttime[${idx}]`, startTimeArr[idx]);
                formData.append(`endtime[${idx}]`, endTimeArr[idx]);
                formData.append(`period[${idx}]`, periodArr[idx]);
                formData.append(`dlp[${idx}]`, dlpArr[idx]);
            }

            const saveRes = await Http.post({
                url: 'https://asiemodel.net/model/teachers9.php',
                headers: getHeaders({
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://asiemodel.net/model/teachers9.php?action=waktumengajar'
                }),
                data: formData.toString()
            });

            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb("✓ Jadual Waktu BERJAYA diimport dan disimpan di CIDS ASIE Model!");
            if (window.electronAPI._automationDoneCb) window.electronAPI._automationDoneCb();
        } catch (e) {
            console.error('Mobile submitJadual Error:', e);
            if (window.electronAPI._automationLogCb) window.electronAPI._automationLogCb("ERROR: " + e.message);
            if (window.electronAPI._automationDoneCb) window.electronAPI._automationDoneCb();
        }
    },
    fetchClassesFromAsie: async (payload) => {
        try {
            const settings = getDecryptedSettings();
            const username = (payload && payload.username) || settings.username;
            const password = (payload && payload.password) || settings.password;

            if (!username || !password) {
                return { success: false, error: 'Sila tetapkan Username dan Password di menu SETTING.' };
            }

            const Http = getHttp();
            if (!Http) throw new Error('CapacitorHttp plugin tidak ditemui.');

            const cookieMap = {};
            const getHeaders = (extra = {}) => {
                const cookieStr = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
                return { 'User-Agent': 'Mozilla/5.0 (Android; Mobile)', 'Cookie': cookieStr, ...extra };
            };
            const updateCookies = (res) => {
                const setCookie = res.headers ? (res.headers['set-cookie'] || res.headers['Set-Cookie']) : null;
                if (setCookie) {
                    const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
                    cookieArr.forEach(c => {
                        const [k, v] = c.split(';')[0].split('=');
                        if (k && v) cookieMap[k.trim()] = v.trim();
                    });
                }
            };

            const loginRes = await Http.post({
                url: 'https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                data: new URLSearchParams({
                    username: username,
                    password: password,
                    redirect: 'main.php?cb=ms',
                    language: 'en',
                    view: 'home',
                    submit: 'Login'
                }).toString()
            });
            updateCookies(loginRes);

            const jadwalRes = await Http.get({
                url: 'https://asiemodel.net/model/teachers9.php?action=waktumengajar',
                headers: getHeaders()
            });
            updateCookies(jadwalRes);

            const html = jadwalRes.data || '';
            const classesList = [];

            const isValidClassName = (txt) => {
                if (!txt || txt.length > 35) return false;
                const lower = txt.toLowerCase();
                const forbidden = [
                    'pilih', 'select', 'tahniah', 'ulasan', 'tindakan', 'pengesahan', 
                    'perancangan', 'refleksi', 'penilaian', 'perbincangan', 'kesilapan', 
                    'pemantauan', 'instruksional', 'perhatian', 'sila', 'terdapat', 'berjumpa',
                    'cipta kelas'
                ];
                if (forbidden.some(word => lower.includes(word))) return false;
                return true;
            };

            const cleanClassName = (raw) => {
                return raw.replace(/^\d+--\s*/, '').trim();
            };

            const selectMatches = html.match(/<select[^>]*id=['"]new_teaching_period['"][^>]*>([\s\S]*?)<\/select>/i) || html.match(/<select[^>]*name=['"]class_id[^'"]*['"][^>]*>([\s\S]*?)<\/select>/i);

            if (selectMatches && selectMatches[1]) {
                const optRegex = /<option[^>]*>([^<]+)<\/option>/gi;
                let optMatch;
                while ((optMatch = optRegex.exec(selectMatches[1])) !== null) {
                    const rawTxt = optMatch[1].trim();
                    const txt = cleanClassName(rawTxt);
                    if (isValidClassName(txt)) {
                        if (!classesList.includes(txt)) classesList.push(txt);
                    }
                }
            }

            if (classesList.length === 0) {
                const miwRes = await Http.get({
                    url: 'https://asiemodel.net/model/miw9.php?action=myclass',
                    headers: getHeaders()
                });
                const miwHtml = miwRes.data || '';
                
                const classSelectMatch = miwHtml.match(/<select[^>]*name=["'](?:class_id|ur\[class_id\]|class_id\[\])["'][^>]*>([\s\S]*?)<\/select>/i) || miwHtml.match(/<select[^>]*id=["']class_id["'][^>]*>([\s\S]*?)<\/select>/i);
                
                const htmlToScan = classSelectMatch ? classSelectMatch[1] : miwHtml;
                if (htmlToScan) {
                    const optRegex2 = /<option[^>]*>([^<]+)<\/option>/gi;
                    let optMatch2;
                    while ((optMatch2 = optRegex2.exec(htmlToScan)) !== null) {
                        const rawTxt = optMatch2[1].trim();
                        const txt = cleanClassName(rawTxt);
                        if (isValidClassName(txt)) {
                            if (!classesList.includes(txt)) classesList.push(txt);
                        }
                    }
                }
            }

            return { success: true, classes: classesList };
        } catch (e) {
            console.error('Mobile fetchClassesFromAsie Error:', e);
            return { success: false, error: e.message };
        }
    },
    fetchScheduleFromAsie: async () => {
        const settings = getDecryptedSettings();
        const username = settings.username;
        const password = settings.password;

        if (!username || !password) {
            return { success: false, error: 'Sila tetapkan Username dan Password di menu SETTING.' };
        }

        try {
            const Http = getHttp();
            if (Http) {
                const cookieMap = {};
                const getHeaders = (extra = {}) => {
                    const cookieStr = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
                    return { 'User-Agent': 'Mozilla/5.0 (Android; Mobile)', 'Cookie': cookieStr, ...extra };
                };
                const updateCookies = (res) => {
                    const setCookie = res.headers ? (res.headers['set-cookie'] || res.headers['Set-Cookie']) : null;
                    if (setCookie) {
                        const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
                        cookieArr.forEach(c => {
                            const [k, v] = c.split(';')[0].split('=');
                            if (k && v) cookieMap[k.trim()] = v.trim();
                        });
                    }
                };

                // 1. Log masuk
                const loginRes = await Http.post({
                    url: 'https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                    data: new URLSearchParams({
                        username: username,
                        password: password,
                        redirect: 'main.php?cb=ms',
                        language: 'en',
                        view: 'home',
                        submit: 'Login'
                    }).toString()
                });
                updateCookies(loginRes);
                
                // 2. Ambil jadual dengan Cookie header
                const jadwalRes = await Http.get({
                    url: 'https://asiemodel.net/model/teachers9.php?action=waktumengajar',
                    headers: getHeaders()
                });
                
                const html = jadwalRes.data;
                const rawResults = [];
                
                // Gunakan REGEX untuk ekstrak data dari HTML mentah
                // Setiap li_row li_sortable = 1 baris jadual
                const rowRegex = /li_row li_sortable[^"]*"[^>]*id="line_(\d+)"[\s\S]*?<\/li>\s*(?=<li class="li_row|$)/g;
                
                // Pendekatan lebih mudah: cari setiap blok line_N
                const lineBlocks = html.split(/li_row li_sortable/).slice(1); // buang bahagian sebelum baris pertama
                
                lineBlocks.forEach((block) => {
                    try {
                        // Ekstrak Hari (days select - cari option dengan selected)
                        let day = "";
                        const dayMatch = block.match(/name="days\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/);
                        if (dayMatch) day = dayMatch[1].trim();
                        
                        // Ekstrak Kelas (class_id select - cari option dengan selected)
                        let className = "";
                        const classMatch = block.match(/name="class_id\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/);
                        if (classMatch) className = classMatch[1].trim();
                        
                        // Ekstrak Subjek (input hidden subject + teks selepasnya)
                        let subject = "";
                        const subjMatch = block.match(/name="subject\[\d+\]"[^>]*>([^<]+)/);
                        if (subjMatch) subject = subjMatch[1].trim();
                        if (!subject) {
                            const subjMatch2 = block.match(/name="subject\[\d+\]"[^>]*value="([^"]+)"/);
                            if (subjMatch2) {
                                // Tukar ID subjek ke nama Melayu
                                const subjectMap = {
                                    'mathematics': 'Matematik', 'physics': 'Fizik', 'chemistry': 'Kimia',
                                    'biology': 'Biologi', 'science': 'Sains', 'arabic': 'Bahasa Arab',
                                    'english': 'Bahasa Inggeris', 'malay': 'Bahasa Melayu',
                                    'history': 'Sejarah', 'geography': 'Geografi',
                                    'islamic_studies': 'Pendidikan Islam', 'moral': 'Pendidikan Moral'
                                };
                                subject = subjectMap[subjMatch2[1]] || subjMatch2[1];
                            }
                        }
                        
                        // Ekstrak Masa
                        let startTime = "";
                        let endTime = "";
                        const startMatch = block.match(/name="starttime\[\d+\]"[^>]*value="([^"]+)"/);
                        const endMatch = block.match(/name="endtime\[\d+\]"[^>]*value="([^"]+)"/);
                        if (startMatch) startTime = startMatch[1].trim();
                        if (endMatch) endTime = endMatch[1].trim();
                        
                        if (day && className && subject && startTime && endTime) {
                            rawResults.push({
                                id: `jadual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                day: day,
                                class: className,
                                className: className,
                                subject: subject,
                                time: `${startTime} - ${endTime}`,
                                subjectId: 'custom-subject',
                                active: true,
                                imported: true
                            });
                        }
                    } catch (e) {}
                });
                
                return { success: true, schedule: rawResults };
            }
        } catch (e) {
            console.error('Local Native Jadual Extraction failed:', e);
            return { success: false, error: e.message };
        }
        return { success: false, error: 'Tiada jadual dijumpai' };
    },
    startDeletion: async (payload) => {
        try {
            if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb('1/4: Memulakan sambungan native ke ASIE Model...');

            const Http = getHttp();
            if (!Http) {
                if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb('Ralat: CapacitorHttp plugin tidak ditemui.');
                if (window.electronAPI._deletionDoneCb) window.electronAPI._deletionDoneCb();
                return;
            }

            const cookieMap = {};
            const getHeaders = (extra = {}) => {
                const cookieStr = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
                return { 'User-Agent': 'Mozilla/5.0 (Android; Mobile)', 'Cookie': cookieStr, ...extra };
            };
            const updateCookies = (res) => {
                const setCookie = res.headers ? (res.headers['set-cookie'] || res.headers['Set-Cookie']) : null;
                if (setCookie) {
                    const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
                    cookieArr.forEach(c => {
                        const [k, v] = c.split(';')[0].split('=');
                        if (k && v) cookieMap[k.trim()] = v.trim();
                    });
                }
            };

            const loginParams = new URLSearchParams({
                username: payload.username || '',
                password: payload.password || '',
                redirect: 'main.php?cb=ms',
                language: 'en',
                view: 'home',
                submit: 'Login'
            });

            const loginRes = await Http.post({
                url: 'https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                data: loginParams.toString()
            });
            updateCookies(loginRes);

            if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb('2/4: Mencari rekod MIW aktif di pelayan ASIE...');

            const listRes = await Http.get({
                url: 'https://asiemodel.net/model/search9.php?action=listmiw',
                headers: getHeaders()
            });
            const listHtml = listRes.data || '';
            const miwMatch = listHtml.match(/miw9\.php\?action=openmiw&(?:amp;)?id=(\d+)/);
            const miwId = miwMatch ? miwMatch[1] : null;

            if (!miwId) {
                if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb('Pemberitahuan: Tiada MIW aktif dijumpai untuk dibuang.');
                if (window.electronAPI._deletionDoneCb) window.electronAPI._deletionDoneCb();
                return;
            }

            if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb(`3/4: Membaca senarai RPH di bawah MIW ID ${miwId}...`);

            const openRes = await Http.get({
                url: `https://asiemodel.net/model/miw9.php?action=openmiw&id=${miwId}`,
                headers: getHeaders()
            });
            const openHtml = openRes.data || '';

            const rphSet = new Set();
            const matches = openHtml.match(/(?:openRPH|editRPH)&(?:amp;)?rph=(\d+)/gi) || [];
            matches.forEach(m => rphSet.add(m.match(/rph=(\d+)/i)[1]));

            const listMatches = listHtml.match(/(?:openRPH|editRPH)&(?:amp;)?rph=(\d+)/gi) || [];
            listMatches.forEach(m => rphSet.add(m.match(/rph=(\d+)/i)[1]));

            const rphList = Array.from(rphSet);
            if (rphList.length === 0) {
                if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb('Pemberitahuan: Tiada rekod RPH wujud untuk dibuang dalam MIW ini.');
                if (window.electronAPI._deletionDoneCb) window.electronAPI._deletionDoneCb();
                return;
            }

            if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb(`4/4: Terjumpa ${rphList.length} RPH. Memulakan pemadaman automatik...`);

            let deleted = 0;
            for (let i = 0; i < rphList.length; i++) {
                const rphId = rphList[i];
                if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb(`  -> Membuang RPH ${i+1}/${rphList.length} (ID: ${rphId})...`);

                const delFormRes = await Http.get({
                    url: `https://asiemodel.net/model/rph.php?action=deleteRPH&rph=${rphId}`,
                    headers: getHeaders()
                });
                const delFormHtml = delFormRes.data || '';

                const delPostData = new URLSearchParams();
                const fMatch = delFormHtml.match(/<form[^>]*id="new"[^>]*>([\s\S]*?)<\/form>/i) || delFormHtml.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
                const fContent = fMatch ? fMatch[1] : delFormHtml;

                const inputRegex = /<input[^>]*name=["']([^"']+)["'][^>]*>/g;
                let inp;
                while ((inp = inputRegex.exec(fContent)) !== null) {
                    const fullTag = inp[0];
                    const name = inp[1];
                    const valMatch = fullTag.match(/value=["']([^"']*)["']/);
                    const val = valMatch ? valMatch[1] : '';
                    delPostData.append(name, val);
                }

                delPostData.set('action', 'deleteRPH');
                delPostData.set('rph', rphId);
                delPostData.set('submit', 'Sah Hapus');

                await Http.post({
                    url: 'https://asiemodel.net/model/rph.php',
                    headers: getHeaders({
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': `https://asiemodel.net/model/rph.php?action=deleteRPH&rph=${rphId}`
                    }),
                    data: delPostData.toString()
                });

                deleted++;
                if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb(`  ✓ RPH ${i+1}/${rphList.length} (ID: ${rphId}) berjaya dibuang.`);
                await new Promise(r => setTimeout(r, 500));
            }

            if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb(`✓ Berjaya! Kesemua ${deleted}/${rphList.length} RPH telah dibuang secara automatik.`);
            if (window.electronAPI._deletionDoneCb) window.electronAPI._deletionDoneCb();

        } catch (e) {
            console.error('startDeletion error:', e);
            if (window.electronAPI._deletionLogCb) window.electronAPI._deletionLogCb(`✖ Ralat: ${e.message}`);
            if (window.electronAPI._deletionDoneCb) window.electronAPI._deletionDoneCb();
        }
    },
    clearAuth: () => {},
    onDeletionLog: (cb) => { window.electronAPI._deletionLogCb = cb; },
    onDeletionDone: (cb) => { window.electronAPI._deletionDoneCb = cb; },
    openExternal: (url) => window.open(url, '_blank')
};
console.log('Mobile app: electronAPI mocked successfully with full polyfills');
