document.addEventListener('DOMContentLoaded', () => {
    // POLYFILL UNTUK ASAR/FILE PROTOCOL di Electron
    if (typeof chrome === 'undefined') {
        window.chrome = {};
    }
    if (!chrome.storage) {
        chrome.storage = {
            local: {
                get: function(keys, cb) {
                    let res = {};
                    if(Array.isArray(keys)) {
                        keys.forEach(k => {
                            let v = localStorage.getItem(k);
                            if(v) { try{res[k]=JSON.parse(v);}catch(e){res[k]=v;} }
                        });
                    }
                    if(cb) cb(res);
                },
                set: function(obj, cb) {
                    for(let k in obj) {
                        localStorage.setItem(k, JSON.stringify(obj[k]));
                    }
                    if(cb) cb();
                },
                remove: function(keys, cb) {
                    if(Array.isArray(keys)) keys.forEach(k => localStorage.removeItem(k));
                    if(cb) cb();
                }
            }
        };
    }
    if (!chrome.tabs) {
        chrome.tabs = {
            query: function(opts, cb) { cb([{id: 0}]); },
            sendMessage: function(tabId, message, cb) {
                if (window.electronAPI && window.electronAPI.fillFormQueue && message.action === "fillFormQueue") {
                    window.electronAPI.fillFormQueue(message.data, message.url);
                }
                if(cb) cb({status: "success"});
            }
        };
    }
    if (!chrome.runtime) {
        chrome.runtime = { lastError: null };
    }
    
    // Dashboard Navigation
    const dashboardView = document.getElementById('dashboardView');
    const rptAssistView = document.getElementById('rptAssistView');
    const btnGoRpt = document.getElementById('btnGoRpt');
    const btnBackDash = document.getElementById('btnBackDash');
    
    if (btnGoRpt && btnBackDash) {
        btnGoRpt.addEventListener('click', () => {
            dashboardView.style.display = 'none';
            rptAssistView.style.display = 'block';
        });
        
        btnBackDash.addEventListener('click', () => {
            rptAssistView.style.display = 'none';
            dashboardView.style.display = 'flex';
        });
    }





    const apiKeyInput = document.getElementById('apiKey');
    const namaRekodInput = document.getElementById('namaRekod');
    const helpText = document.getElementById('namaRekodHelp');
    const fileInput = document.getElementById('imageFile');
    const processBtn = document.getElementById('processBtn');
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    const statusDiv = document.getElementById('status');
    const resultActionContainer = document.getElementById('resultActionContainer');
    const salinCidsBtn = document.getElementById('salinCidsBtn');

    // Dropzone elements
    const dropZone = document.getElementById('dropZone');
    const browseBtn = document.getElementById('browseBtn');
    const filePreview = document.getElementById('filePreview');

    // Debug elements
    const toggleDevBtn = document.getElementById('toggleDevBtn');
    const debugSection = document.getElementById('debugSection');
    const manualRowsContainer = document.getElementById('manualRowsContainer');
    const addManualRowBtn = document.getElementById('addManualRowBtn');
    const insertAllBtn = document.getElementById('insertAllBtn');

    const settingsBtn = document.getElementById('settingsBtn');
    const apiKeySection = document.getElementById('apiKeySection');

    settingsBtn.addEventListener('click', () => {
        apiKeySection.style.display = apiKeySection.style.display === 'none' ? 'block' : 'none';
        window.scrollTo(0, 0);
    });

    // Dropzone Logic
    browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
    });

    dropZone.addEventListener('click', (e) => {
        if(e.target !== browseBtn && e.target !== fileInput) {
            fileInput.click();
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#3b82f6';
        dropZone.style.background = 'rgba(59, 130, 246, 0.1)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(100, 116, 139, 0.4)';
        dropZone.style.background = 'rgba(255, 255, 255, 0.3)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(100, 116, 139, 0.4)';
        dropZone.style.background = 'rgba(255, 255, 255, 0.3)';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    document.addEventListener('paste', (e) => {
        if (e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    const datatransfer = new DataTransfer();
                    datatransfer.items.add(blob);
                    fileInput.files = datatransfer.files;
                    handleFileSelection(blob);
                    break;
                }
            }
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileSelection(fileInput.files[0]);
        }
    });

    function handleFileSelection(file) {
        let fileName = file.name || "Gambar dari clipboard";
        filePreview.textContent = "Fail bersedia: " + fileName;
        statusDiv.innerText = "";
    }

    toggleDevBtn.addEventListener('click', () => {
        if (debugSection.style.display === 'block') {
            debugSection.style.display = 'none';
        } else {
            debugSection.style.display = 'block';
            window.scrollTo(0, document.body.scrollHeight);
        }
    });

    function saveAllManualRows() {
        const rows = document.querySelectorAll('#manualRowsContainer > div');
        const dataArray = [];
        rows.forEach(row => {
            dataArray.push({
                namaRekodForm: row.querySelector('.mNamaRekod').value,
                tarikhDari: row.querySelector('.mTarikhDari').value,
                tarikhHingga: row.querySelector('.mTarikhHingga').value,
                mingguKalendar: row.querySelector('.mMinggu').value,
                bidangPembelajaran: row.querySelector('.mTema').value,
                tajukPembelajaran: row.querySelector('.mBidang').value,
                standardKandungan: row.querySelector('.mSK').value,
                standardPembelajaran: row.querySelector('.mSP').value,
                objektifPembelajaran: row.dataset.obj || '',
                kriteriaKejayaan: row.dataset.krik || '',
                catatan: row.dataset.catatan || ''
            });
        });
        chrome.storage.local.set({ manualTestData: dataArray });
        return dataArray;
    }

    function renderManualRows(dataArray) {
        manualRowsContainer.innerHTML = '';
        
        if (!dataArray || dataArray.length === 0) {
            deleteAllBtn.style.display = 'none';
        } else {
            deleteAllBtn.style.display = 'block';
        }
        
        dataArray.forEach((data, index) => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px dashed rgba(100, 116, 139, 0.3);';
            row.dataset.obj = data.objektifPembelajaran || '';
            row.dataset.krik = data.kriteriaKejayaan || '';
            row.dataset.catatan = data.catatan || '';
            row.innerHTML = `
                <input type="text" class="mNamaRekod" placeholder="1. Nama" value="${data.namaRekodForm || ''}" style="font-size: 12px; width: 100px; flex-shrink: 0;">
                <input type="text" class="mTarikhDari" placeholder="2. Mula" value="${data.tarikhDari || ''}" style="font-size: 12px; width: 100px; flex-shrink: 0;">
                <input type="text" class="mTarikhHingga" placeholder="3. Akhir" value="${data.tarikhHingga || ''}" style="font-size: 12px; width: 100px; flex-shrink: 0;">
                <input type="text" class="mMinggu" placeholder="4. Minggu" value="${data.mingguKalendar || ''}" style="font-size: 12px; width: 100px; flex-shrink: 0;">
                <input type="text" class="mTema" placeholder="5. Tema" value="${data.bidangPembelajaran || ''}" style="font-size: 12px; width: 100px; flex-shrink: 0;">
                <input type="text" class="mBidang" placeholder="6. Bidang" value="${data.tajukPembelajaran || ''}" style="font-size: 12px; width: 100px; flex-shrink: 0;">
                <textarea class="mSK" placeholder="7. SK" style="font-size: 12px; width: 150px; flex-shrink: 0; min-height: 40px; resize: vertical; border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 8px; padding: 4px; background: rgba(255, 255, 255, 0.4); color: #0f172a; backdrop-filter: blur(4px);">${data.standardKandungan || ''}</textarea>
                <textarea class="mSP" placeholder="8. SP" style="font-size: 12px; width: 150px; flex-shrink: 0; min-height: 40px; resize: vertical; border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 8px; padding: 4px; background: rgba(255, 255, 255, 0.4); color: #0f172a; backdrop-filter: blur(4px);">${data.standardPembelajaran || ''}</textarea>
                <button class="testRowBtn" style="background: rgba(5, 150, 105, 0.15); border: 1px solid rgba(5, 150, 105, 0.3); font-size: 12px; padding: 6px; margin-top: 0; flex-shrink: 0; color: #047857; border-radius: 8px; cursor: pointer; backdrop-filter: blur(4px);">Isi</button>
                <button class="delRowBtn" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); font-size: 12px; padding: 6px; margin-top: 0; flex-shrink: 0; color: #b91c1c; border-radius: 8px; cursor: pointer; backdrop-filter: blur(4px);">X</button>
            `;
            
            row.querySelector('.testRowBtn').addEventListener('click', () => {
                const updatedArray = saveAllManualRows();
                sendToContentScript(updatedArray[index]);
            });

            row.querySelector('.delRowBtn').addEventListener('click', () => {
                const updatedArray = saveAllManualRows();
                updatedArray.splice(index, 1);
                chrome.storage.local.set({ manualTestData: updatedArray });
                renderManualRows(updatedArray);
            });
            
            manualRowsContainer.appendChild(row);
        });
    }

    addManualRowBtn.addEventListener('click', () => {
        const currentData = saveAllManualRows();
        let nextNamaRekod = "";
        if (currentData.length > 0) {
            nextNamaRekod = incrementRekod(currentData[currentData.length - 1].namaRekodForm);
        }
        currentData.push({ namaRekodForm: nextNamaRekod });
        renderManualRows(currentData);
    });

    deleteAllBtn.addEventListener('click', () => {
        if (confirm("Adakah anda pasti untuk memadam semua hasil imbasan?")) {
            chrome.storage.local.remove(['manualTestData', 'pendingInsertData'], () => {
                fileInput.value = '';
                document.getElementById('statusWrapper').style.display = 'none';
                statusDiv.innerHTML = '';
                fileInput.value = '';
                if (filePreview && filePreview.textContent) {
                    filePreview.textContent = '';
                }
                renderManualRows([]);
                resultActionContainer.style.display = 'none';
            });
        }
    });

    insertAllBtn.addEventListener('click', () => {
        const currentData = saveAllManualRows();
        if (currentData.length > 0) {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                const selectedRptUrl = null;
                chrome.tabs.sendMessage(tabs[0]?.id || 0, { action: "fillFormQueue", data: currentData, url: selectedRptUrl }, function(response) {
                    showStatus("Memasukkan ke dalam sistem auto-fill...", false);
                });
            });
            
            // Kemaskini skrin - kosongkan manualTestData sebab semua dah dihantar ke queue
            chrome.storage.local.set({ manualTestData: [] });
            renderManualRows([]);
        } else {
            showStatus("Tiada data untuk dimasukkan.", true);
        }
    });

    window.addEventListener('ELECTRON_QUEUE_FINISHED', () => {
        showStatus("✅ Semua SP telah berjaya dimasukkan ke dalam RPT CIDS!", false);
        const processBtn = document.getElementById('processBtn');
        if(processBtn) processBtn.disabled = false;
    });

    window.addEventListener('ELECTRON_QUEUE_PROGRESS', (e) => {
        if(e.detail) {
            showStatus(e.detail, false);
        }
    });

    salinCidsBtn.addEventListener('click', () => {
        insertAllBtn.click();
    });

    // Load saved data
    chrome.storage.local.get(['geminiApiKey', 'lastNamaRekod', 'manualTestData'], (result) => {
        let defaultApiKey = "AIzaSyAF72h7KkNzq3Z9C0_pp9vA0rDITm97_jc";
        let currentApiKey = result.geminiApiKey || defaultApiKey;
        apiKeyInput.value = currentApiKey;
        
        if (!result.geminiApiKey) {
            chrome.storage.local.set({ geminiApiKey: defaultApiKey });
        }
        
        settingsBtn.classList.remove('pulsating');
        apiKeyInput.classList.remove('pulsating-input');
        apiKeySection.style.display = 'none';

        if (result.lastNamaRekod) {
            helpText.innerText = "Seterusnya diramal: " + incrementRekod(result.lastNamaRekod);
        }
        let savedData = result.manualTestData;
        if (savedData && !Array.isArray(savedData)) {
            savedData = [savedData];
        }
        renderManualRows(savedData || []);
    });

    apiKeyInput.addEventListener('change', (e) => {
        const val = e.target.value.trim();
        chrome.storage.local.set({ geminiApiKey: val });
        if (val) {
            settingsBtn.classList.remove('pulsating');
            apiKeyInput.classList.remove('pulsating-input');
            apiKeySection.style.display = 'none';
        } else {
            settingsBtn.classList.add('pulsating');
            apiKeyInput.classList.add('pulsating-input');
            apiKeySection.style.display = 'block';
        }
    });

    processBtn.addEventListener('click', async () => {
        try {
        statusDiv.innerHTML = '';
        const namaRekodVal = namaRekodInput.value.trim();
        if (!namaRekodVal) {
            showStatus("Sila isikan Nama Rekod sebelum mengimbas RPT.", true);
            namaRekodInput.focus();
            return;
        }

        const file = fileInput.files[0];
        const csvData = document.getElementById('csvData').value.trim();

        if (!file && !csvData) {
            showStatus("Sila muat naik fail gambar/PDF atau tampal teks CSV.", true);
            return;
        }

        resultActionContainer.style.display = 'none';
        
        // LOCAL HEURISTIC PARSER (BYPASS AI)
        if (csvData) {
            function parseData(str) {
                const rows = [];
                const lines = str.split('\n');
                for (let line of lines) {
                    if (!line.trim()) continue;
                    let cols = line.split(/\t/);
                    if (cols.length < 3) cols = line.split(/ {2,}/);
                    rows.push(cols.map(c => c.trim()));
                }
                
                const results = [];
                for (let cols of rows) {
                    let minggu = "", tarikhDari = "", tarikhHingga = "";
                    let tema = "", bidang = "", sk = "", sp = "", obj = "", krik = "";
                    
                    if (cols.length < 3) {
                        // Heavily glued string (no tabs, just single spaces)
                        let str = cols.join(" ").trim();
                        let spMatch = str.match(/\b\d+\.\d+\.\d+\b/);
                        if (spMatch) {
                            let parts = str.split(spMatch[0]);
                            let beforeSP = parts[0];
                            let afterSP = parts[1] || "";
                            sp = spMatch[0];
                            let skMatches = [...beforeSP.matchAll(/\b\d+\.\d+\b/g)];
                            if (skMatches.length >= 2) {
                                let lastSK = skMatches[skMatches.length - 1];
                                bidang = beforeSP.substring(0, lastSK.index).trim();
                                sk = beforeSP.substring(lastSK.index).trim();
                            } else if (skMatches.length === 1) {
                                let lastSK = skMatches[0];
                                bidang = beforeSP.substring(0, lastSK.index).trim();
                                sk = beforeSP.substring(lastSK.index).trim();
                            } else {
                                bidang = beforeSP.trim();
                            }
                            sp += " " + afterSP.trim();
                        } else {
                            bidang = str;
                        }
                        
                        let dateMatch = bidang.match(/(\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?\s*[-–]\s*\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\s*[-–]\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\/\-.]\d{1,2}\s*[-–]\s*\d{1,2}[\/\-.]\d{1,2})/i);
                        if (dateMatch) {
                            let dStr = dateMatch[1];
                            let parts = dStr.split(/[-–]/);
                            if (parts.length >= 2) { tarikhDari = parts[0].trim(); tarikhHingga = parts[1].trim(); }
                            let beforeDate = bidang.substring(0, dateMatch.index).trim();
                            tema = bidang.substring(dateMatch.index + dateMatch[0].length).trim();
                            let mMatch = beforeDate.match(/^M?\s*(\d+)/i) || beforeDate.match(/^Minggu\s*(\d+)/i) || beforeDate.match(/^(\d+)/);
                            if (mMatch) minggu = mMatch[1];
                            bidang = tema;
                            tema = "";
                        }
                        let xZeroMatch = bidang.match(/\b\d+\.0\b/);
                        if (xZeroMatch) {
                            tema = bidang.substring(0, xZeroMatch.index).trim();
                            bidang = bidang.substring(xZeroMatch.index).trim();
                        } else {
                            tema = bidang; bidang = "";
                        }
                        results.push({ mingguKalendar: minggu, tarikhDari, tarikhHingga, bidangPembelajaran: tema, tajukPembelajaran: bidang, standardKandungan: sk, standardPembelajaran: sp, objektifPembelajaran: obj, kriteriaKejayaan: krik });
                        continue;
                    }

                    let unusedCols = [...cols];
                    
                    // 1. Find Minggu
                    let mIdx = unusedCols.findIndex(c => /^M?\s*\d+$/i.test(c) || /^Minggu\s*\d+/i.test(c));
                    if (mIdx !== -1) {
                        let mMatch = unusedCols[mIdx].match(/\d+/);
                        if (mMatch) minggu = mMatch[0];
                        unusedCols.splice(mIdx, 1);
                    }
                    
                    // 2. Find Tarikh and split if glued with Tema
                    let tIdx = unusedCols.findIndex(c => /\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?\s*[-–]\s*\d{1,2}/i.test(c) || /\d{1,2}[\/\-.]\d{1,2}/.test(c));
                    if (tIdx !== -1) {
                        let tStr = unusedCols[tIdx];
                        let dateMatch = tStr.match(/(\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?\s*[-–]\s*\d{1,2}\s*(?:jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis|[a-z]+)?|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\s*[-–]\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\/\-.]\d{1,2}\s*[-–]\s*\d{1,2}[\/\-.]\d{1,2})/i);
                        if (dateMatch) {
                            let dStr = dateMatch[1];
                            let parts = dStr.split(/[-–]/);
                            if (parts.length >= 2) { tarikhDari = parts[0].trim(); tarikhHingga = parts[1].trim(); }
                            let rest = tStr.replace(dateMatch[0], '').trim();
                            if (rest) tema = rest;
                        } else { tarikhDari = tStr; }
                        unusedCols.splice(tIdx, 1);
                    }
                    
                    // 3. Find SP
                    let spIdx = unusedCols.findIndex(c => /\d+\.\d+\.\d+/.test(c));
                    if (spIdx !== -1) { sp = unusedCols[spIdx]; unusedCols.splice(spIdx, 1); }
                    
                    // 4. Find SK and split if glued with Bidang
                    let skIdx = unusedCols.findIndex(c => /\d+\.\d+/.test(c));
                    if (skIdx !== -1) {
                        let skStr = unusedCols[skIdx];
                        let matches = [...skStr.matchAll(/(\d+\.\d+)/g)];
                        if (matches.length >= 2) {
                            let splitIdx = matches[1].index;
                            bidang = skStr.substring(0, splitIdx).trim();
                            sk = skStr.substring(splitIdx).trim();
                        } else { sk = skStr; }
                        unusedCols.splice(skIdx, 1);
                    }
                    
                    // Remaining
                    if (unusedCols.length > 0 && !tema) tema = unusedCols.shift();
                    if (unusedCols.length > 0 && !bidang) bidang = unusedCols.shift();
                    if (unusedCols.length > 0) obj = unusedCols.shift();
                    if (unusedCols.length > 0) krik = unusedCols.shift();
                    
                    results.push({ mingguKalendar: minggu, tarikhDari, tarikhHingga, bidangPembelajaran: tema, tajukPembelajaran: bidang, standardKandungan: sk, standardPembelajaran: sp, objektifPembelajaran: obj, kriteriaKejayaan: krik });
                }
                
                // Filter out empty rows or header rows
                let filtered = results.filter(r => {
                    let text = Object.values(r).join(" ").toLowerCase();
                    if (text.trim() === "") return false;
                    if (text.includes("minggu") && text.includes("tarikh") && !r.mingguKalendar.match(/\d/)) return false;
                    return true;
                });
                
                // MERGE LOGIC: Gabungkan SP untuk minggu yang sama
                let merged = [];
                let currentWeek = null;
                let currentItem = null;

                for (let r of filtered) {
                    let week = r.mingguKalendar;
                    if (!week && currentWeek) {
                        week = currentWeek; // inherit previous week if empty
                    }

                    if (week && week === currentWeek && currentItem) {
                        // merge into currentItem
                        if (r.standardKandungan && !currentItem.standardKandungan.includes(r.standardKandungan)) {
                            currentItem.standardKandungan += (currentItem.standardKandungan ? "\n" : "") + r.standardKandungan;
                        }
                        if (r.standardPembelajaran && !currentItem.standardPembelajaran.includes(r.standardPembelajaran)) {
                            currentItem.standardPembelajaran += (currentItem.standardPembelajaran ? "\n" : "") + r.standardPembelajaran;
                        }
                        if (r.bidangPembelajaran && !currentItem.bidangPembelajaran.includes(r.bidangPembelajaran)) {
                            currentItem.bidangPembelajaran += (currentItem.bidangPembelajaran ? " " : "") + r.bidangPembelajaran;
                        }
                        if (r.tajukPembelajaran && !currentItem.tajukPembelajaran.includes(r.tajukPembelajaran)) {
                            currentItem.tajukPembelajaran += (currentItem.tajukPembelajaran ? " " : "") + r.tajukPembelajaran;
                        }
                        if (r.objektifPembelajaran && !currentItem.objektifPembelajaran.includes(r.objektifPembelajaran)) {
                            currentItem.objektifPembelajaran += (currentItem.objektifPembelajaran ? "\n" : "") + r.objektifPembelajaran;
                        }
                        if (r.kriteriaKejayaan && !currentItem.kriteriaKejayaan.includes(r.kriteriaKejayaan)) {
                            currentItem.kriteriaKejayaan += (currentItem.kriteriaKejayaan ? "\n" : "") + r.kriteriaKejayaan;
                        }
                    } else {
                        // new item
                        currentWeek = week;
                        currentItem = { ...r, mingguKalendar: week };
                        merged.push(currentItem);
                    }
                }

                return merged;
            }

                const results = parseData(csvData);
                
                if (results.length > 0) {
                    showStatus("BERJAYA: Memproses jadual secara terus menggunakan Sistem Tempatan (Tanpa AI)...");
                    setTimeout(() => {
                        let finalNamaRekodBase = namaRekodInput.value.trim();
                        if (!finalNamaRekodBase) {
                            chrome.storage.local.get(['lastNamaRekod'], (res) => {
                                if (res.lastNamaRekod) finalNamaRekodBase = incrementRekod(res.lastNamaRekod);
                                else if (results[0].namaRekod) finalNamaRekodBase = results[0].namaRekod;
                                processArray(finalNamaRekodBase, results);
                            });
                        } else {
                            processArray(finalNamaRekodBase, results);
                        }
                        processBtn.disabled = false;
                    }, 1000);
                    return; // Stop here, bypass AI
                }
            }
        
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showStatus("API Key Gemini diperlukan untuk memproses gambar/dokumen ini. Sila klik butang ⚙️ di penjuru kanan atas untuk memasukkan API Key.", true);
            return;
        }
        
        showStatus("Memproses data menggunakan AI... sila tunggu...");
        processBtn.disabled = true;

        try {
            
            const currentYear = new Date().getFullYear();
            let tahunInstruction = `- Untuk tarikh, automatik ubah ke format DD-MM-YYYY (contohnya 1 January menjadi 01-01-${currentYear}). WAJIB masukkan tahun ${currentYear} secara automatik jika tahun tidak dinyatakan dalam dokumen.`;
            
            const promptText = `Sila ekstrak maklumat dari gambar/PDF jadual (Rancangan Pelajaran Tahunan / RPT) ini ke dalam format JSON yang sah.
Mesti patuh pada medan ini sahaja:
- namaRekod (Cari di lajur pertama, contoh: MTT2M16. Biarkan kosong "" jika tiada)
- mingguKalendar (Cari 'Minggu Kalendar' atau 'Minggu Instruksional', ekstrak nombor. PENTING: Jika jadual mengandungi baris/tarikh berturutan, nombor minggu MESTI bertambah secara berurutan (cth: 1, 2, 3). Baiki secara automatik jika jadual asal mempunyai typo di mana nombor minggu tidak bertambah.)
- tarikhDari (Format DD-MM-YYYY dari bahagian Tarikh)
- tarikhHingga (Format DD-MM-YYYY dari bahagian Tarikh)
- bidangPembelajaran (Salin ejaan penuh yang wujud di lajur Bidang Pembelajaran)
- tajukPembelajaran (Salin ejaan penuh jika wujud Tajuk)
- standardKandungan (Salin sepenuhnya. Jika ada pelbagai standard kandungan berbeza (cth: 6.1.1 dan 6.1.2), letakkan setiap satu di baris baharu menggunakan \n)
- standardPembelajaran (Salin sepenuhnya. Jika ada pelbagai standard pembelajaran berbeza (cth: 6.2.1 dan 6.2.2), WAJIB letakkan setiap satu di baris baharu menggunakan \n. DILARANG campur dalam satu baris.)
- objektifPembelajaran (Salin sepenuhnya jika ada)
- kriteriaKejayaan (Salin sepenuhnya jika ada)
- catatan (Salin sepenuhnya mana-mana teks catatan yang ada. Contoh: Cuti Umum, Isra' Mikraj, aktiviti, dll. Jika tiada, biarkan kosong.)

PENTING:
- Jika dikesan beberapa minggu yang BERBEZA (minggu berlainan), kembalikan senarai laporan (array of objects). Auto tambah objek baru untuk setiap minggu berlainan.
- Jika dikesan beberapa rekod dalam MINGGU YANG SAMA, gabungkan dalam satu laporan bersesuaian, jangan pisahkan kepada objek berlainan.
${tahunInstruction}

HANYA kembalikan JSON Array of Objects bermula dengan "[" dan berakhir "]". Tiada markdown backticks. `;

             const parts = [{ text: promptText }];
             if (file) {
                 if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt') || file.type.startsWith('text/')) {
                     const text = await file.text();
                     parts.push({ text: '\n\nData Fail (' + file.name + '):\n' + text });
                 } else if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
                     try {
                         const arrayBuffer = await file.arrayBuffer();
                         const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                         parts.push({ text: '\n\nData Dokumen (' + file.name + '):\n' + result.value });
                     } catch (err) {
                         console.error("Ralat membaca Word:", err);
                         showStatus("Ralat membaca fail Word. Pastikan format serasi.", true);
                         processBtn.disabled = false;
                         return;
                     }
                 } else {
                     const base64 = await fileToBase64(file);
                     parts.push({
                         inlineData: {
                             data: base64.split(',')[1],
                             mimeType: file.type
                         }
                     });
                 }
             }
             if (csvData) {
                 parts.push({ text: `\n\nData CSV/Teks:\n${csvData}` });
             }

             const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     contents: [{ parts: parts }],
                     generationConfig: { responseMimeType: "application/json" }
                 })
             });

             const data = await response.json();
             if (data.error) throw new Error(data.error.message);
             
             let resultText = data.candidates[0].content.parts[0].text;
             
             // Bersihkan mana-mana markdown json yang mungkin ada
             resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
             
             let extractedDataArray;
             try {
                 const parsed = JSON.parse(resultText);
                 extractedDataArray = Array.isArray(parsed) ? parsed : [parsed];
                 
                 // Force sequential week numbering if dates change
                 let lastDate = "";
                 let lastWeek = -1;
                 for (let i = 0; i < extractedDataArray.length; i++) {
                     let item = extractedDataArray[i];
                     let currentWeek = parseInt(item.mingguKalendar) || 1;
                     
                     if (i > 0) {
                         if (item.tarikhDari && item.tarikhDari !== lastDate) {
                             if (currentWeek <= lastWeek) {
                                 // Dates advanced but week did not (typo in source), auto-increment!
                                 item.mingguKalendar = (lastWeek + 1).toString();
                             }
                         }
                     }
                     lastDate = item.tarikhDari || lastDate;
                     lastWeek = parseInt(item.mingguKalendar) || lastWeek;
                 }
             } catch (e) {
                 throw new Error("Gagal memproses JSON yang dikembalikan oleh AI.");
             }

             // Tentukan Nama Rekod Base
             let finalNamaRekodBase = namaRekodInput.value.trim();
             if (!finalNamaRekodBase) {
                chrome.storage.local.get(['lastNamaRekod'], (res) => {
                    if (res.lastNamaRekod) {
                        finalNamaRekodBase = incrementRekod(res.lastNamaRekod);
                    } else if (extractedDataArray.length > 0 && extractedDataArray[0].namaRekod) {
                        finalNamaRekodBase = extractedDataArray[0].namaRekod;
                    }
                    processArray(finalNamaRekodBase, extractedDataArray);
                });
             } else {
                 processArray(finalNamaRekodBase, extractedDataArray);
             }
        } catch (err) {
            showStatus("Ralat: " + err.message, true);
            processBtn.disabled = false;
        }
        } catch (fatalErr) {
            alert("FATAL ERROR: " + fatalErr.message + "\n" + fatalErr.stack);
        }
    });

    function processArray(baseNama, dataArray) {
        const currentYear = new Date().getFullYear();
        
        function formatTarikh(str) {
            if (!str) return str;
            str = str.toString().trim();
            
            // If already perfectly formatted: DD-MM-YYYY
            if (/^\d{2}-\d{2}-\d{4}$/.test(str)) return str;
            
            // Map for months
            const months = {
                'jan': '01', 'january': '01', 'januari': '01',
                'feb': '02', 'february': '02', 'februari': '02',
                'mar': '03', 'march': '03', 'mac': '03',
                'apr': '04', 'april': '04',
                'may': '05', 'mei': '05',
                'jun': '06', 'june': '06',
                'jul': '07', 'july': '07', 'julai': '07',
                'aug': '08', 'august': '08', 'ogos': '08',
                'sep': '09', 'september': '09',
                'oct': '10', 'october': '10', 'oktober': '10',
                'nov': '11', 'november': '11',
                'dec': '12', 'december': '12', 'disember': '12'
            };

            let parts = str.split(/[\s\-/\\]+/);
            if (parts.length >= 2) {
                let day = parts[0].replace(/\D/g, '').padStart(2, '0');
                let monthStr = parts[1].toLowerCase().replace(/[^a-z0-9]/g, '');
                let month = months[monthStr] || (isNaN(monthStr) ? '01' : monthStr.padStart(2, '0'));
                let year = (parts.length >= 3) ? parts[2].replace(/\D/g, '') : currentYear.toString();
                
                if (year.length === 2) year = '20' + year;
                if (year.length !== 4) year = currentYear.toString();
                
                return `${day}-${month}-${year}`;
            }
            
            return str;
        }

        let currentNama = baseNama;
        for (let i = 0; i < dataArray.length; i++) {
            dataArray[i].namaRekodForm = currentNama;
            if (dataArray[i].tarikhDari) dataArray[i].tarikhDari = formatTarikh(dataArray[i].tarikhDari);
            if (dataArray[i].tarikhHingga) dataArray[i].tarikhHingga = formatTarikh(dataArray[i].tarikhHingga);
            
            if (currentNama) {
                currentNama = incrementRekod(currentNama);
            }
        }
        finalize(dataArray);
    }

    function finalize(dataArray) {
        if (dataArray.length > 0 && dataArray[dataArray.length - 1].namaRekodForm) {
             chrome.storage.local.set({ lastNamaRekod: dataArray[dataArray.length - 1].namaRekodForm });
        }
        
        // Simpan dalam storage untuk tatapan di Ujian Manual
        chrome.storage.local.set({ manualTestData: dataArray });
        
        // Kemaskini terus di skrin
        renderManualRows(dataArray);

        document.getElementById('debugSection').style.display = 'block'; // Tunjuk jadual dahulu
        resultActionContainer.style.display = 'block';
        processBtn.disabled = false;
        
        showStatus("Berjaya diekstrak! Sila semak jadual di bawah, dan tekan 'Salin RPT ke CIDS' apabila bersedia.");
    }

    function showStatus(text, isError = false) {
        document.getElementById('statusWrapper').style.display = 'block';
        
        const timeStr = new Date().toLocaleTimeString();
        const p = document.createElement('div');
        p.style.color = isError ? '#ff6188' : (text.includes('Sistem sedia') ? '#78dce8' : '#a9dc76');
        p.innerText = `> [${timeStr}] ${text}`;
        statusDiv.appendChild(p);
        statusDiv.scrollTop = statusDiv.scrollHeight;
    }

    function incrementRekod(prev) {
        if (!prev) return "";
        let match = prev.match(/^(.*?)(\d+)$/);
        if (match) return match[1] + (parseInt(match[2]) + 1);
        return prev;
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    function sendToContentScript(currentData) {
        showStatus("Siap. Memasukkan ke laman web...");
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const selectedRptUrl = null;
            chrome.tabs.sendMessage(tabs[0]?.id || 0, { action: "fillFormQueue", data: currentData, url: selectedRptUrl }, function(response) {
                if (chrome.runtime.lastError) {
                    showStatus("Ralat Laman Muka: Sila buka laman CIDS dan Refresh (F5) sebelum guna.", true);
                } else {
                    showStatus("Berjaya memasukkan data!");
                }
                processBtn.disabled = false;
            });
        });
    }

    const copyPromptBtn = document.getElementById('copyPromptBtn');
    if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', () => {
            const promptText = document.getElementById('hiddenPrompt').value;
            navigator.clipboard.writeText(promptText).then(() => {
                const originalText = copyPromptBtn.innerHTML;
                copyPromptBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Disalin!`;
                setTimeout(() => { copyPromptBtn.innerHTML = originalText; }, 2000);
            });
        });
    }

    const copyUrlBtn = document.getElementById('copyUrlBtn');
    if (copyUrlBtn) {
        copyUrlBtn.addEventListener('click', () => {
            const urlText = "https://gemini.google.com/gem/1ZPoGMnnlUPzjYXAbiU0sVcHf8EoRu4Qh?usp=sharing";
            navigator.clipboard.writeText(urlText).then(() => {
                const originalText = copyUrlBtn.innerHTML;
                copyUrlBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Disalin!`;
                setTimeout(() => { copyUrlBtn.innerHTML = originalText; }, 2000);
            });
        });
    }
});