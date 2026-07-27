const { launchBrowser } = require('../playwright-launcher');
const { generateRPH } = require('./ai-generator');
const fs = require('fs');
const path = require('path');

async function submitRPH(lessons, miwDate, credentials = {}, apiKey = null, bbm = []) {
    let resultStats = { successCount: 0, skippedCount: 0, errors: [] };
    const os = require('os');
    const platform = os.platform();
    let userDataPath;
    
    if (process.env.VERCEL || process.env.AWS_REGION) {
        userDataPath = '/tmp';
    } else {
        userDataPath = platform === 'win32' 
            ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'rph-automator')
            : (platform === 'darwin' 
                ? path.join(os.homedir(), 'Library', 'Application Support', 'rph-automator')
                : path.join(os.homedir(), '.config', 'rph-automator'));
    }
    
    if (!fs.existsSync(userDataPath) && !(process.env.VERCEL || process.env.AWS_REGION)) {
        fs.mkdirSync(userDataPath, { recursive: true });
    }

    const authPath = path.join(userDataPath, 'auth.json');
    if (!fs.existsSync(authPath)) {
        if (credentials.username && credentials.password) {
            fs.writeFileSync(authPath, '{}'); // Cipta fail kosong untuk dimuatkan
        } else {
            console.error("Ralat: auth.json tidak dijumpai! Sila masukkan maklumat log masuk di paparan utama atau jalankan 'setup-login.js'.");
            return;
        }
    }

    console.log("Melancarkan Playwright...");
    // Tukar headless: true jika mahu ia berjalan di latar belakang tanpa UI
    const browser = await launchBrowser({ headless: true }); 
    const context = await browser.newContext({ storageState: authPath });
    const page = await context.newPage();
    
    // Block images, fonts, and css to save memory
    await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
            route.abort();
        } else {
            route.continue();
        }
    });

    try {
        console.log("Membuka ASIE Model...");
        console.log(`[DEBUG] Credentials: username=${credentials.username}, password=${credentials.password ? '***' + credentials.password.slice(-3) : 'TIADA'}`);
        
        // --- AUTO-LOGIN SECTION ---
        await page.goto('https://asiemodel.net/model/main.php?cb=ms', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000); // Tunggu redirect jika ada
        
        // Log diagnostik
        const currentUrl = page.url();
        const pageTitle = await page.title();
        console.log(`[DEBUG] Selepas goto: URL=${currentUrl}, Title=${pageTitle}`);
        
        if (credentials.username && credentials.password) {
            // Semak jika ruangan log masuk (username/email) wujud pada halaman
            const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="login"], input[placeholder="Login"], input[placeholder="Username"], input[placeholder*="E-mel"]').first();
            
            if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log("Halaman log masuk dikesan. Sedang cuba log masuk secara automatik...");
                try {
                    await emailInput.fill(credentials.username);
                    
                    const pwdInput = page.locator('input[type="password"], input[name="password"], input[placeholder="Password"]').first();
                    if (await pwdInput.isVisible()) {
                        await pwdInput.fill(credentials.password);
                        await page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Log Masuk")').first().click();
                    } else {
                        await page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click();
                        await page.waitForTimeout(3000); 
                        if (await pwdInput.isVisible({ timeout: 5000 })) {
                            await pwdInput.fill(credentials.password);
                            await page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click();
                        }
                    }
                    
                    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
                    console.log("Log masuk automatik selesai.");
                    
                    const afterLoginUrl = page.url();
                    const afterLoginTitle = await page.title();
                    console.log(`[DEBUG] Selepas login: URL=${afterLoginUrl}, Title=${afterLoginTitle}`);
                    
                    await context.storageState({ path: authPath });
                    
                    // Pergi semula ke halaman utama selepas login
                    await page.goto('https://asiemodel.net/model/main.php?cb=ms', { waitUntil: 'domcontentloaded', timeout: 30000 });
                } catch(e) {
                    console.log("Log masuk automatik tidak berjaya: " + e.message);
                    
                    // Cuba login melalui POST langsung (fallback)
                    console.log("[FALLBACK] Cuba login melalui POST terus...");
                    try {
                        await page.goto('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', { waitUntil: 'domcontentloaded', timeout: 15000 });
                        await page.waitForTimeout(1000);
                        const loginInput = page.locator('input[name="username"], input[name="login"], input[type="email"]').first();
                        if (await loginInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                            await loginInput.fill(credentials.username);
                            const pwdInput2 = page.locator('input[type="password"]').first();
                            await pwdInput2.fill(credentials.password);
                            await page.locator('input[type="submit"], button[type="submit"]').first().click();
                            await page.waitForTimeout(5000);
                            console.log(`[FALLBACK] Selepas login POST: URL=${page.url()}`);
                        }
                    } catch(e2) {
                        console.log("[FALLBACK] Login POST juga gagal: " + e2.message);
                    }
                }
            } else {
                console.log("[DEBUG] Tiada login form dikesan - mungkin sudah log masuk.");
            }
        }
        
        // Diagnostic: log halaman semasa sebelum masuk ke loop kelas
        const preLoopUrl = page.url();
        const preLoopTitle = await page.title();
        const bodyText = await page.locator('body').textContent().catch(() => 'GAGAL BACA BODY');
        console.log(`[DEBUG] Sebelum loop: URL=${preLoopUrl}, Title=${preLoopTitle}`);
        console.log(`[DEBUG] Body text (200 char): ${bodyText.substring(0, 200)}`);
        
        // Semak jika pautan eRPH wujud
        const erpLinks = await page.locator('a').evaluateAll(links => links.map(l => ({ text: l.textContent.trim().substring(0,30), href: l.href })).filter(l => l.text.toLowerCase().includes('rph') || l.text.toLowerCase().includes('erph')));
        console.log(`[DEBUG] Pautan eRPH dijumpai: ${JSON.stringify(erpLinks)}`);
        // --------------------------
        
        // Daftar listener dialog SECARA GLOBAL di luar loop untuk elakkan pertindihan
        page.on('dialog', async dialog => {
            try {
                await dialog.accept();
            } catch (err) {
                // Abaikan ralat 'Cannot accept dialog which is already handled'
            }
        });
        
        // Di sini kita loop untuk setiap kelas (atau subjek) yang ada
        for (const lesson of lessons) {
            try {
                console.log(`\nMemproses RPH untuk: ${lesson.subject_id} | ${lesson.class_id}`);
                
                // Pergi ke halaman asal setiap kali untuk memulakan pemilihan baharu
                await page.goto('https://asiemodel.net/model/main.php?cb=ms', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2000);
                
                // Cuba klik eRPH dengan pelbagai cara
                let erphClicked = false;
                try {
                    await page.getByRole('link', { name: 'eRPH' }).click({ timeout: 10000 });
                    erphClicked = true;
                } catch (e1) {
                    console.log('[DEBUG] getByRole eRPH gagal, cuba locator text...');
                    try {
                        await page.locator('a:has-text("eRPH"), a:has-text("RPH"), a[href*="rph"], a[href*="RPH"]').first().click({ timeout: 10000 });
                        erphClicked = true;
                    } catch (e2) {
                        console.log('[DEBUG] locator text juga gagal, cuba href langsung...');
                        try {
                            // Cuba navigate terus ke halaman eRPH
                            await page.goto('https://asiemodel.net/model/main.php?cb=rph', { waitUntil: 'domcontentloaded', timeout: 15000 });
                            erphClicked = true;
                        } catch (e3) {
                            const curUrl = page.url();
                            const curBody = await page.locator('body').textContent().catch(() => '');
                            throw new Error(`Gagal navigasi ke eRPH. URL semasa: ${curUrl}. Body: ${curBody.substring(0, 150)}`);
                        }
                    }
                }
                
                if (erphClicked) {
                    await page.waitForTimeout(1500);
                    try {
                        await page.getByRole('link', { name: 'Buka Rekod' }).click({ timeout: 10000 });
                    } catch (e) {
                        console.log('[DEBUG] Buka Rekod gagal, cuba locator...');
                        await page.locator('a:has-text("Buka Rekod"), a:has-text("buka rekod")').first().click({ timeout: 10000 }).catch(() => {
                            console.log('[DEBUG] Buka Rekod juga gagal - mungkin sudah di halaman yang betul');
                        });
                    }
                }
                await page.waitForTimeout(1500);
            
            // 1. Pilih Kelas (Aras Kelas) menggunakan Padanan Pintar
            const classOptions = await page.locator('#select_classlevel option').evaluateAll(opts => 
                opts.map(o => ({ value: o.value, text: o.text.trim() }))
            );
            console.log("Class Options Available:", JSON.stringify(classOptions));
            
            let matchedClassValue = null;
            const targetClassId = lesson.class_id || lesson.class_name || lesson.class || "";
            
            // Cubaan 1: Padanan Tepat (Exact match)
            let exactClassMatch = classOptions.find(o => o.value === targetClassId);
            
            // Cubaan 2: Fallback value (cth: cg_secondary-form2 -> form2)
            const fallbackClassVal = targetClassId.includes('-') ? targetClassId.split('-')[1] : targetClassId.toLowerCase().trim();
            if (!exactClassMatch) {
                exactClassMatch = classOptions.find(o => o.value === fallbackClassVal || o.text.toLowerCase() === targetClassId.toLowerCase());
            }
            
            if (exactClassMatch) {
                matchedClassValue = exactClassMatch.value;
            } else {
                // Cubaan 3: Padanan teks (Fuzzy match)
                // Convert form2 -> tingkatan 2, year1 -> tahun 1
                let fuzzySearchTerm = "";
                if (fallbackClassVal.startsWith('form')) {
                    fuzzySearchTerm = 'tingkatan ' + fallbackClassVal.replace('form', '');
                } else if (fallbackClassVal.startsWith('year')) {
                    fuzzySearchTerm = 'tahun ' + fallbackClassVal.replace('year', '');
                } else {
                    // Fallback for names like '1 RAUDAH' or '2 AMANAH' -> 'tahun 1' or 'tingkatan 1'
                    const matchNumber = fallbackClassVal.match(/\d+/);
                    if (matchNumber) {
                        fuzzySearchTerm = matchNumber[0]; // just use the number to match "Tahun 1" or "Tingkatan 1" based on text
                    }
                }
                
                if (fuzzySearchTerm) {
                    const textMatch = classOptions.find(o => o.text.toLowerCase().includes(fuzzySearchTerm));
                    if (textMatch) {
                        matchedClassValue = textMatch.value;
                        console.log(`[Pintar Kelas] Menukar ${targetClassId} kepada ${matchedClassValue} (${textMatch.text})`);
                    }
                }
            }
            
            if (matchedClassValue) {
                await page.locator('#select_classlevel').selectOption(matchedClassValue);
                console.log(`[Semak Silang Berjaya] Aras Kelas dipilih dalam dropdown: "${matchedClassValue}"`);
            } else {
                console.log(`[Ralat] Gagal memadankan Aras Kelas untuk ${targetClassId}. Aras kelas ini tiada dalam senarai pilihan. Melangkau kelas ini...`);
                resultStats.skippedCount++;
                resultStats.errors.push(`Gagal padanan kelas: ${targetClassId}`);
                continue;
            }
            
            // TUNGGU AJAX SIAP SELEPAS TUKAR KELAS (SANGAT PENTING)
            await page.waitForTimeout(2500);
            
            // Padanan pintar (Smart Matching) untuk subjek
            const subjectOptions = await page.locator('#select_subject option').evaluateAll(opts => 
                opts.map(o => ({ value: o.value, text: o.text.trim() }))
            );
            
            let matchedValue = null;
            const targetId = lesson.subject_id || lesson.subject || "";
            
            // Cubaan 1: Cari padanan tepat (exact value match)
            const exactMatch = subjectOptions.find(o => o.value === targetId);
            if (exactMatch) {
                matchedValue = exactMatch.value;
            } else {
                // Cubaan 2: Cari padanan teks (label match)
                const targetTextLower = targetId.toLowerCase().trim();
                const textMatch = subjectOptions.find(o => 
                    o.text.toLowerCase() === targetTextLower || 
                    o.text.toLowerCase().includes(targetTextLower.replace('sg_language-', '').replace('sg_science_math-', ''))
                );
                
                if (textMatch) {
                    matchedValue = textMatch.value;
                    console.log(`[Pintar] Menukar ${targetId} kepada ${matchedValue} (${textMatch.text})`);
                } else {
                    // Cubaan 3: Carian fuzzy berdasarkan subject_text atau targetId
                    const subjectTextAI = (lesson.subject_text || "").toLowerCase();
                    
                    const fuzzyMatch = subjectOptions.find(o => {
                        const sText = o.text.toLowerCase();
                        
                        // Jika ada subject_text dari AI dan ia berpadanan
                        if (subjectTextAI && subjectTextAI.length > 2 && sText.includes(subjectTextAI)) return true;
                        
                        // Padanan tradisional (fallback)
                        if (targetId.includes('melayu') && sText.includes('melayu')) return true;
                        if ((targetId.includes('sains') || targetId.includes('science')) && sText.includes('sains')) return true;
                        if ((targetId.includes('matematik') || targetId.includes('mathematics')) && sText.includes('matematik')) return true;
                        if (targetId.includes('inggeris') && sText.includes('inggeris')) return true;
                        if (targetId.includes('english') && sText.includes('inggeris')) return true;
                        if ((targetId.includes('sejarah') || targetId.includes('history')) && sText.includes('sejarah')) return true;
                        if (targetId.includes('jawi') && sText.includes('jawi')) return true;
                        if (targetId.includes('arab') && sText.includes('arab')) return true;
                        if (targetId.includes('pi') && sText.includes('pendidikan islam')) return true;
                        return false;
                    });
                    
                    if (fuzzyMatch) {
                        matchedValue = fuzzyMatch.value;
                        console.log(`[Fuzzy] Menukar ${targetId}/${subjectTextAI} kepada ${matchedValue} (${fuzzyMatch.text})`);
                    }
                }
            }
            
            let finalSubjectText = "";
            if (matchedValue) {
                await page.locator('#select_subject').selectOption(matchedValue);
                
                // MEKANISME SEMAK SILANG
                const selectedSubjectText = await page.locator('#select_subject option:checked').textContent();
                finalSubjectText = selectedSubjectText.trim();
                console.log(`[Semak Silang Berjaya] Subjek dipilih dalam dropdown: "${finalSubjectText}" untuk kelas "${lesson.session_text}".`);
            } else {
                const requestedSubj = lesson.subject_text || targetId;
                console.error(`[Ralat Semak Silang] Gagal memilih subjek! "${requestedSubj}" tidak ditemui dalam senarai dropdown ASIE.`);
                console.log(`Tindakan: Kelas "${lesson.session_text}" dilangkau untuk mengelakkan ralat RPH pada subjek yang salah.`);
                continue; // Jangan teruskan klik Cari atau cipta RPH secara membabi buta!
            }
            
            await page.getByRole('button', { name: 'Cari' }).click();
            await page.waitForTimeout(3000); // PENTING: Tunggu page dimuat naik semula!
            
            // 2. Klik pautan MIW (Berdasarkan tarikh mingguan di dalam rekod)
            console.log(`Mencari pautan MIW untuk tarikh: ${miwDate}`);
            
            // Mekanisme untuk memastikan tab bulan yang betul dipilih
            const dateParts = miwDate ? miwDate.match(/(\d{2})-(\d{2})-(\d{4})/) : null;
            if (dateParts) {
                const monthNum = parseInt(dateParts[2], 10);
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const targetMonth = monthNames[monthNum - 1];
                console.log(`Memastikan tab bulan ${targetMonth} dipilih...`);
                try {
                    // Cari pautan bulan
                    const monthLink = page.getByRole('link', { name: targetMonth, exact: true });
                    // Tunggu pautan muncul jika page masih loading
                    await monthLink.waitFor({ state: 'visible', timeout: 3000 });
                    
                    await monthLink.click();
                    await page.waitForTimeout(2000); // Tunggu MIW table untuk refresh selepas tukar bulan
                } catch (e) {
                    console.log(`Tab bulan ${targetMonth} tidak dapat diklik atau mungkin sudah sedia dipilih.`);
                }
            }

            const miwLink = page.locator('tr').filter({ hasText: miwDate }).getByRole('link', { name: 'MIW' }).first();
            await miwLink.click();
            await page.waitForTimeout(3000);
            
            const miwUrl = page.url(); // Simpan URL MIW untuk pusingan seterusnya

            // --- PROSES PEMBUANGAN RPH LAMA (HAPUS RPH) ---
            console.log("Menyemak jika perlu menghapuskan RPH lama untuk kelas ini...");
            try {
                // Cari mana-mana butang 'Hapus RPH' di skrin secara rakus (greedy)
                let hapusBtn = page.getByText('Hapus RPH', { exact: false }).first();
                
                while (await hapusBtn.isVisible({ timeout: 2000 })) {
                    console.log("RPH sedia ada dikesan. Sedang menghapus...");
                    await hapusBtn.click();
                    await page.waitForTimeout(1500);

                    // Cari butang 'YA' (Popup HTML) jika ada
                    const yaBtn = page.getByRole('button', { name: 'YA', exact: false }).filter({ state: 'visible' }).first();
                    if (await yaBtn.isVisible({ timeout: 2000 })) {
                        await yaBtn.click();
                        console.log("Menekan butang YA.");
                    }
                    
                    await page.waitForTimeout(4000); // Tunggu sistem refresh selepas delete
                    console.log("RPH lama berjaya dihapuskan!");
                    
                    // Cari semula jika ada lagi yang perlu dihapuskan
                    hapusBtn = page.getByText('Hapus RPH', { exact: false }).first();
                }
            } catch (e) {
                // Abaikan jika tiada butang hapus
                console.log("Tiada pembersihan RPH diperlukan.");
            }
            // ----------------------------------------------

            // 3. Klik Ikon Jadual (Untuk buka pop-up senarai kelas)
            await page.waitForTimeout(1500); // Tunggu sebentar untuk pastikan halaman dimuat sepenuhnya
            await page.locator('img[src="/images/database_table.png"]').first().click();
            await page.waitForTimeout(2000); // Tambah masa menunggu sedikit
            
            // Tunggu elemen dalam jadual dimuatkan (AJAX)
            await page.locator('li.period').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
            
            // Dapatkan jumlah slot untuk kelas ini
            // KITA PERLU TAPIS MENGIKUT KELAS DAN SUBJEK AGAR TIDAK BERCAMPUR
            const allClassSlots = page.locator('li.period.subject').filter({ hasText: lesson.session_text });
            const slotCount = await allClassSlots.count();
            
            let targetSlotIndices = [];
            
            for(let j = 0; j < slotCount; j++) {
                const text = (await allClassSlots.nth(j).textContent()).toLowerCase();
                const subjLower = finalSubjectText.toLowerCase();
                
                // Cari padanan nama subjek di dalam teks slot
                let match = false;
                if (text.includes(subjLower)) match = true;
                else {
                    // Fuzzy match untuk subjek (singkatan dsb)
                    const subjekKataKunci = subjLower.split(/\s+/).filter(w => w.length > 3);
                    if (subjekKataKunci.length > 0 && subjekKataKunci.some(w => text.includes(w))) {
                        match = true;
                    }
                    // Hardcoded fallbacks untuk subjek popular yang sering disingkatkan
                    if (targetId.includes('pjpk') && (text.includes('pjpk') || text.includes('jasmani'))) match = true;
                    if (targetId.includes('pendidikan islam') && text.includes('pi')) match = true;
                    if (targetId.includes('sains') && text.includes('sains')) match = true;
                }
                
                if(match) {
                    targetSlotIndices.push(j);
                }
            }
            
            targetSlotIndices = await allClassSlots.evaluateAll((elements, matchedIndices) => {
                let uniqueDayIndices = [];
                let seenDays = new Set();
                
                matchedIndices.forEach(idx => {
                    const el = elements[idx];
                    if (el) {
                        const tr = el.closest('tr');
                        // Gunakan rowIndex sebagai penanda hari unik (kerana 1 TR = 1 Hari/Waktu)
                        const dayId = tr ? tr.rowIndex : 'unknown_' + idx;
                        if (!seenDays.has(dayId)) {
                            seenDays.add(dayId);
                            uniqueDayIndices.push(idx);
                        }
                    }
                });
                return uniqueDayIndices;
            }, targetSlotIndices);
            
            let totalSlots = targetSlotIndices.length;
            let usingFuzzySlot = false;
            let fuzzySlotText = "";
            
            if (totalSlots === 0 && slotCount > 0) {
                 // Kalau filter subjek terlalu ketat, kita fallback ambil je semua slot kelas tu
                 console.log(`Amaran: Gagal memadankan subjek "${finalSubjectText}" di dalam jadual untuk kelas ${lesson.session_text}. Mengambil semua slot kelas secara pukal.`);
                 // Kita ambil 1 slot sahaja per hari secara pukal
                 targetSlotIndices = await allClassSlots.evaluateAll((elements) => {
                    let uniqueDayIndices = [];
                    let seenDays = new Set();
                    elements.forEach((el, idx) => {
                        const tr = el.closest('tr');
                        const dayId = tr ? tr.rowIndex : 'unknown_' + idx;
                        if (!seenDays.has(dayId)) {
                            seenDays.add(dayId);
                            uniqueDayIndices.push(idx);
                        }
                    });
                    return uniqueDayIndices;
                 });
                 totalSlots = targetSlotIndices.length;
            }
            
            const targetSessions = totalSlots;
            
            if (targetSessions === 0) {
                console.log(`Tiada slot jadual dijumpai untuk ${lesson.session_text}. Melangkau...`);
                await page.keyboard.press('Escape');
                resultStats.skippedCount++;
                resultStats.errors.push(`Jadual ASIE tiada slot untuk kelas ${lesson.session_text}`);
                continue;
            }
            
            console.log(`${totalSlots} slot jadual dikesan. Sasaran: ${targetSessions} sesi berasingan...`);
            
            let successfulSessions = 0;
            for (let i = 0; i < totalSlots; i++) {
                if (successfulSessions >= targetSessions) {
                    console.log(`Berjaya mencapai sasaran ${targetSessions} sesi. Berhenti untuk kelas ini.`);
                    break;
                }
                
                const slotIndex = targetSlotIndices[i];
                const currentSessionText = usingFuzzySlot ? fuzzySlotText : lesson.session_text;
                console.log(`\n--- Menjana RPH untuk Sesi ${successfulSessions + 1} (${currentSessionText} - Slot ke-${i+1}) ---`);
                
                // Klik pada kotak subjek (Guna currentSessionText dan slotIndex yang telah ditapis)
                await allClassSlots.nth(slotIndex).click({ force: true });
            
            // Tunggu modal ANALISIS (atau modal berkaitan) muncul
            await page.waitForTimeout(1500);
            
            // --- LOGIK PENGAGIHAN TICK STANDARD PEMBELAJARAN (DI DALAM MODAL MIW) ---
            console.log(`Menyemak kotak pilihan (checkbox) Standard Kandungan & Pembelajaran di modal MIW untuk agihan Sesi ${successfulSessions + 1}...`);
            await page.evaluate(({ sessionIndex, targetSessions }) => {
                const chunkCheckboxes = (checkboxes, S, sIndex) => {
                    if (!checkboxes || checkboxes.length <= 1) return;
                    const N = checkboxes.length;
                    const chunks = Array.from({ length: S }, () => []);
                    const baseSize = Math.floor(N / S);
                    const remainder = N % S;
                    let itemIndex = 0;
                    
                    for (let j = 0; j < S; j++) {
                        let size = baseSize + (j < remainder ? 1 : 0);
                        for (let k = 0; k < size; k++) {
                            chunks[j].push(itemIndex++);
                        }
                    }
                    
                    const myChunk = chunks[sIndex] || [];
                    
                    for (let j = 0; j < N; j++) {
                        const cb = checkboxes[j];
                        if (!cb.disabled) {
                            const shouldBeChecked = myChunk.includes(j);
                            if (shouldBeChecked && !cb.checked) {
                                cb.click();
                            } else if (!shouldBeChecked && cb.checked) {
                                cb.click();
                            }
                        }
                    }
                };

                let skUl = document.querySelector('ul.standard_kandungan');
                let spUl = document.querySelector('ul.standard_pembelajaran');
                let skCheckboxes = [];
                let spCheckboxes = [];
                
                if (skUl) {
                    skCheckboxes = Array.from(skUl.querySelectorAll('input[type="checkbox"]'));
                }
                if (spUl) {
                    spCheckboxes = Array.from(spUl.querySelectorAll('input[type="checkbox"]'));
                }
                
                if (spCheckboxes.length === 0) {
                    const allCbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                    spCheckboxes = allCbs.filter(cb => {
                        const parentText = cb.parentElement?.textContent || '';
                        const nextText = cb.nextSibling?.textContent || '';
                        const hasNumber = /\d+\.\d+\.\d+/.test(parentText) || /\d+\.\d+\.\d+/.test(nextText);
                        const hasArabicNumber = /[\u0660-\u0669]+\.[\u0660-\u0669]+\.[\u0660-\u0669]+/.test(parentText) || /[\u0660-\u0669]+\.[\u0660-\u0669]+\.[\u0660-\u0669]+/.test(nextText);
                        return hasNumber || hasArabicNumber;
                    });
                }
                
                if (skCheckboxes.length === 0) {
                    const allCbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                    skCheckboxes = allCbs.filter(cb => {
                        if (spCheckboxes.includes(cb)) return false;
                        const parentText = cb.parentElement?.textContent || '';
                        const nextText = cb.nextSibling?.textContent || '';
                        const hasNumber = /^\s*\d+\.\d+(\s|$)/.test(parentText) || /^\s*\d+\.\d+(\s|$)/.test(nextText);
                        return hasNumber;
                    });
                }
                
                if (spCheckboxes.length === 0 && skCheckboxes.length === 0) {
                    const allCbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                    if (allCbs.length > 3) {
                        spCheckboxes = allCbs.slice(3);
                    }
                }
                
                let targetCheckboxes = [...skCheckboxes, ...spCheckboxes];
                
                if (targetCheckboxes.length === 0) {
                    console.log("Amaran: Tiada kotak Standard Pembelajaran dijumpai untuk ditanda.");
                }
                
                if (targetSessions > 1) {
                    if (skCheckboxes.length > 1) {
                        chunkCheckboxes(skCheckboxes, targetSessions, sessionIndex);
                    }
                    if (spCheckboxes.length > 1) {
                        chunkCheckboxes(spCheckboxes, targetSessions, sessionIndex);
                    }
                }

                // PASTIKAN SEMUA KOTAK WAJIB (Kelas, Subjek, Tema, dll) DITANDA
                const allCbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                
                allCbs.forEach(cb => {
                    // Abaikan checkbox kawalan (selectAll/deselectAll)
                    if (cb.id && cb.id.startsWith('selectControl')) return;
                    
                    if (!targetCheckboxes.includes(cb)) {
                        if (!cb.checked && !cb.disabled) {
                            cb.click();
                            cb.checked = true; // Paksa tandakan sekiranya click() diabaikan
                        }
                    }
                });
                
            }, { sessionIndex: successfulSessions, targetSessions: targetSessions });
            
            // Tunggu sekejap untuk pastikan AJAX save selesai jika ada
            await page.waitForTimeout(1500);
            
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
                
                // 5. Cipta RPH Baharu
                // Sembunyikan sebarang popup (seperti jadual) yang mungkin menghalang butang
                await page.evaluate(() => {
                    const popups = document.querySelectorAll('[id^="popup_"]');
                    popups.forEach(p => p.style.display = 'none');
                    const overlays = document.querySelectorAll('.fancybox-overlay');
                    overlays.forEach(o => o.style.display = 'none');
                });
                await page.waitForTimeout(500);

                // Check if any error dialog appeared during AJAX save
                let hasAlert = false;
                page.once('dialog', async (dialog) => {
                    hasAlert = true;
                    console.log("Dialog dikesan:", dialog.message());
                });

                let navigated = false;
                try {
                    let btnName = '';
                    if (await page.getByRole('button', { name: 'Cipta RPH' }).isVisible({ timeout: 2000 }).catch(() => false)) {
                        btnName = 'Cipta RPH';
                    } else if (await page.getByRole('button', { name: 'Sunting RPH' }).isVisible({ timeout: 2000 }).catch(() => false)) {
                        btnName = 'Sunting RPH';
                    }
                    
                    if (btnName) {
                        await Promise.all([
                            page.waitForNavigation({ timeout: 45000 }).catch(() => {}),
                            page.getByRole('button', { name: btnName }).click()
                        ]);
                        navigated = true;
                        
                        // Bypass validation dan trick dummy telah dibuang.
                        // Kita akan terus mengisi RPH seperti biasa. Jika baris Aktiviti tiada,
                        // kita akan simpan, kemudian masuk mod Sunting RPH untuk mengisi Aktiviti (Trik Pengguna).
                        console.log(`Berjaya masuk mod ${btnName}.`);
                    }
                } catch (navErr) {
                    if (hasAlert) {
                        console.log("Dialog ralat dari ASIE dikesan! (Mungkin kotak wajib tidak ditanda). Gagal mencipta RPH untuk sesi ini.");
                    } else {
                        console.log(`Tiada navigasi berlaku untuk slot ke-${i+1} (Mungkin slot bergabung atau ralat). Melangkau ke slot seterusnya...`);
                        console.log(`[DEBUG] Ralat Navigasi: ${navErr.message}`);
                    }
                    // Kembali ke MIW jika perlu, atau cuma buka jadual semula
                    await page.goto(miwUrl);
                    await page.waitForTimeout(2000);
                    await page.locator('img[src="/images/database_table.png"]').first().click();
                    await page.waitForTimeout(1500);
                    continue;
                }
                
                if (!navigated) {
                    console.log("Butang Cipta/Sunting RPH tidak dijumpai, meneruskan ke slot lain...");
                    continue;
                }
                
                await page.waitForTimeout(2000); // Tunggu borang RPH dimuat sepenuhnya
                
                // 5.5 Tunggu borang RPH (Iframe Editor) sedia sepenuhnya
                try {
                    await page.waitForSelector('iframe[title="Rich Text Area"]', { state: 'attached', timeout: 30000 });
                } catch (iframeErr) {
                    const errorPic = `error_screenshot_${lesson.session_text.replace(/\s+/g, '_')}_Sesi_${i+1}.png`;
                    await page.screenshot({ path: errorPic, fullPage: true });
                    console.log(`[DEBUG] Ralat Iframe: Screenshot disimpan di ${errorPic}`);
                    throw iframeErr;
                }
                
                await page.waitForTimeout(1500); // Tunggu ekstra untuk script editor habis loading

                console.log("Mengekstrak silibus dari halaman borang...");
                const pageText = await page.locator('body').innerText();
                
                const extractText = (start, end) => {
                    const regex = new RegExp(`${start}[\\s\\S]*?(?=${end}|$)`, 'i');
                    const match = pageText.match(regex);
                    return match ? match[0].replace(new RegExp(start, 'i'), '').trim() : '';
                };

                lesson.bidang = extractText('Bidang Pembelajaran', 'Tajuk Pembelajaran');
                lesson.tajuk = extractText('Tajuk Pembelajaran', 'Standard Kandungan');
                lesson.kandungan = extractText('Standard Kandungan', 'Standard Pembelajaran');
                
                // Untuk 'Standard Pembelajaran', kita ambil teks sehingga menjumpai perkataan 'Objektif' atau baris baharu yang panjang
                const stdMatch = pageText.match(/Standard Pembelajaran([\s\S]*?)(Objektif|Kriteria|Aktiviti|$)/i);
                lesson.standard = stdMatch ? stdMatch[1].trim() : '';

                // Check if PEPERIKSAAN exists ANYWHERE in the extracted page text
                const isExam = pageText.toUpperCase().includes('PEPERIKSAAN');
                let aiText = '';
                
                if (isExam) {
                    console.log("Terkesan silibus PEPERIKSAAN. Menggunakan template RPH Peperiksaan...");
                    aiText = `<p><strong>Fasa 1: Pelibatan (Engage)</strong><br>
Guru memulakan sesi dengan memberi ucapan motivasi ringkas kepada pelajar, menggalakkan mereka untuk memberikan yang terbaik dan bersikap yakin terhadap persediaan mereka.<br>
Guru juga menekankan kepentingan integriti dan pematuhan kepada peraturan peperiksaan.</p>
<p><strong>Fasa 2: Penerokaan (Explore)</strong><br>
Guru mengedarkan kertas soalan dan jawapan kepada setiap pelajar.<br>
Guru memberi penerangan ringkas tentang peraturan peperiksaan, seperti:</p>
<ul>
<li>Masa yang diperuntukkan.</li>
<li>Larangan berkomunikasi sesama pelajar.</li>
<li>Kepentingan memastikan jawapan ditulis dengan jelas dan kemas.</li>
</ul>
<p>Guru memberi masa kepada pelajar untuk membaca arahan pada kertas soalan sebelum peperiksaan bermula.</p>
<p><strong>Fasa 3: Penerangan (Explain)</strong><br>
Pelajar diberi penjelasan terakhir mengenai langkah yang perlu diambil sekiranya mereka menghadapi kesukaran semasa menjawab, seperti mengangkat tangan untuk memanggil guru bagi bantuan teknikal (contoh: kesilapan cetakan soalan).<br>
Guru menjelaskan pentingnya membaca setiap soalan dengan teliti sebelum menjawab.</p>
<p><strong>Fasa 4: Pengembangan (Elaborate)</strong><br>
Peperiksaan dimulakan.<br>
Pelajar menjawab soalan dalam suasana peperiksaan yang tenang dan terkawal.<br>
Guru memantau pelajar untuk memastikan suasana peperiksaan berjalan lancar dan mematuhi peraturan yang ditetapkan.</p>
<p><strong>Fasa 5: Penilaian (Evaluate)</strong><br>
Setelah masa peperiksaan tamat, guru mengarahkan pelajar untuk berhenti menulis.<br>
Guru mengutip kertas jawapan dan kertas soalan daripada semua pelajar.<br>
Guru mengingatkan pelajar tentang jadual peperiksaan seterusnya dan menggalakkan mereka untuk terus membuat persediaan.</p>`;
                } else {
                    // 6. Jana teks RPH menggunakan Gemini AI
                    console.log(`Menjana RPH menggunakan AI...`);
                    aiText = await generateRPH(lesson, i, apiKey, bbm); // Hantar indeks sesi, apiKey, bbm ke AI
                    
                    if (aiText) {
                        aiText = aiText.replace(/```html/gi, '').replace(/```/g, '').trim();
                    }
                }
                
                // 7. Masukkan teks AI ke dalam editor 'Pemudahcaraan & Pelibatan Pelajar'
                console.log("Menyalin teks AI ke dalam borang...");
                
                const injectTextToIframe = async (idx, text) => {
                    // Pastikan checkbox baris ini DITICK supaya ASIE simpan data
                    await page.evaluate((i) => {
                        const iframes = Array.from(document.querySelectorAll('iframe[title="Rich Text Area"]'));
                        const targetIframe = iframes[i];
                        if (targetIframe) {
                            let parent = targetIframe.parentElement;
                            let distance = 0;
                            while (parent && distance < 30) {
                                if (parent.tagName === 'TR') {
                                    const cb = parent.querySelector('input[type="checkbox"]');
                                    if (cb && !cb.checked) {
                                        cb.click();
                                        cb.checked = true;
                                    }
                                    break;
                                }
                                parent = parent.parentElement;
                                distance++;
                            }
                        }
                    }, idx);

                    const richTextBody = page.locator('iframe[title="Rich Text Area"]').nth(idx).contentFrame().locator('body');
                    await richTextBody.waitFor({ state: 'attached', timeout: 30000 });
                    
                    // Guna API TinyMCE/CKEditor untuk setContent
                    await page.evaluate(({i, txt}) => {
                        if (typeof tinymce !== 'undefined' && tinymce.editors && tinymce.editors.length > i) {
                            tinymce.editors[i].setContent(txt);
                            tinymce.editors[i].save();
                        } else if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances) {
                            const instances = Object.values(CKEDITOR.instances);
                            if (instances.length > i) {
                                instances[i].setData(txt);
                            }
                        }
                    }, {i: idx, txt: text});

                    // Fallback: Set innerHTML
                    await richTextBody.evaluate((el, content) => {
                        el.innerHTML = content;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }, text);
                };

                const findIframeIndex = await page.evaluate(() => {
                    const iframes = Array.from(document.querySelectorAll('iframe[title="Rich Text Area"]'));
                    for (let j = 0; j < iframes.length; j++) {
                        let parent = iframes[j].parentElement;
                        let distance = 0;
                        while (parent && distance < 30) {
                            if (parent.tagName === 'TR') {
                                // Cari 'td' yang pertama dalam 'tr' ini
                                const firstTd = parent.querySelector('td, th');
                                if (firstTd) {
                                    const text = firstTd.innerText ? firstTd.innerText.toUpperCase().trim() : '';
                                    if (text === 'AKTIVITI' || text.startsWith('AKTIVITI\n') || text === 'AKTIVITI PEMBELAJARAN') {
                                        return { index: j, found: true };
                                    }
                                }
                            }
                            parent = parent.parentElement;
                            distance++;
                        }
                    }
                    return { index: -1, found: false };
                });
                
                let aktivitiFound = findIframeIndex.found;
                let iframeIndex = findIframeIndex.index;
                
                if (aktivitiFound) {
                    console.log(`Baris AKTIVITI ditemui pada iframe index: ${iframeIndex}. Mengisi teks AI...`);
                    await injectTextToIframe(iframeIndex, aiText);
                } else {
                    console.log("Baris AKTIVITI TIDAK DITEMUI! Teks AI akan diisi selepas proses Sunting (Trik Pengguna).");
                }

                // 7.5 Isi bahagian Menilai dengan Refleksi Custom
                console.log("Mengisi ruangan MENILAI dengan refleksi khusus...");
                let totalStudents = parseInt(lesson.student_count, 10) || 30;

                // Anggaran jumlah murid perlukan penerangan lanjutan (10% hingga 25% dari kelas, minimum 3, maksimum 15)
                let minRand = Math.max(3, Math.floor(totalStudents * 0.1));
                let maxRand = Math.min(15, Math.ceil(totalStudents * 0.25));
                const yRand = Math.floor(Math.random() * (maxRand - minRand + 1)) + minRand;
                
                // Baki murid yang menguasai
                let xTotal = Math.max(0, totalStudents - yRand);
                
                let textBM = `<p>${xTotal} orang murid mencapai dan menguasai semua Objektif Pembelajaran ditetapkan oleh Standard Pembelajaran. ${yRand} orang murid perlu penerangan lanjutan dan telah diberi pentaksiran lisan serta diberi bimbingan bagi mencapai dan menguasai semua Objektif Pembelajaran pada hari ini.</p>`;
                let textBI = `<p>${xTotal} students achieved and mastered all Learning Objectives set by the Learning Standard. ${yRand} students needed further explanation and were given oral assessment as well as guidance to achieve and master all Learning Objectives today.</p>`;
                let textArab = `<p><span dir="rtl">${xTotal} طالباً حققوا وأتقنوا جميع أهداف التعلم المحددة في معيار التعلم. ${yRand} طلاب احتاجوا إلى شرح إضافي وتم إعطاؤهم تقييماً شفوياً بالإضافة إلى التوجيه لتحقيق وإتقان جميع أهداف التعلم اليوم.</span></p>`;
                let textJawi = `<p><span dir="rtl">${xTotal} اورڠ موريد منچڤاي دان مڠواساءي سموا اوبجيكتيف ڤمبلاجرن يڠ دتتڤكن اوليه ستندرد ڤمبلاجرن. ${yRand} اورڠ موريد ڤرلو ڤنرڠن لنجوتن دان تله دبري ڤنتکسيرن ليسن سرتا دبري بيمبيڠن باݢي منچڤاي دان مڠواساءي سموا اوبجيكتيف ڤمبلاجرن ڤد هاري اين.</span></p>`;

                let menilaiText = textBM;
                const checkSubject = (lesson.subject_id + " " + (lesson.subject_text || "")).toLowerCase();
                
                if (checkSubject.includes('english') || checkSubject.includes('inggeris')) {
                    menilaiText = textBI;
                } else if (checkSubject.includes('arab')) {
                    menilaiText = textArab;
                } else if (checkSubject.includes('jawi') || checkSubject.includes('pendidikan islam')) {
                    // Note: If PI uses Rumi mostly, we can adjust, but usually PI/Jawi RPH are written in Jawi.
                    // If the user wants PI in Rumi, we can check just 'jawi'. I'll check 'jawi' first. 
                    // To be safe, let's keep PI as Jawi just in case, or fallback to BM.
                    // The safest is checking 'jawi' for textJawi. Let's make Jawi specific.
                    menilaiText = checkSubject.includes('jawi') ? textJawi : textBM;
                }

                const menilaiIframeIndex = await page.evaluate(() => {
                    const iframes = Array.from(document.querySelectorAll('iframe[title="Rich Text Area"]'));
                    for (let j = 0; j < iframes.length; j++) {
                        let parent = iframes[j].parentElement;
                        let distance = 0;
                        while (parent && distance < 15) {
                            // Cari perkataan 'Menilai' secara case-insensitive
                            if (parent.innerText && parent.innerText.toUpperCase().includes('MENILAI')) {
                                return j;
                            }
                            parent = parent.parentElement;
                            distance++;
                        }
                    }
                    return 1; // fallback ke iframe kedua
                });

                console.log(`Menggunakan iframe index: ${menilaiIframeIndex} untuk Menilai.`);
                const menilaiBody = page.locator('iframe[title="Rich Text Area"]').nth(menilaiIframeIndex).contentFrame().locator('body');
                
                await menilaiBody.waitFor({ state: 'attached', timeout: 30000 });
                
                // Guna API TinyMCE/CKEditor untuk setContent (lebih stabil & elak bug kosong bila sunting)
                await page.evaluate(({idx, text}) => {
                    if (typeof tinymce !== 'undefined' && tinymce.editors && tinymce.editors.length > idx) {
                        tinymce.editors[idx].setContent(text);
                        tinymce.editors[idx].save(); // Sync ke textarea
                    } else if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances) {
                        const instances = Object.values(CKEDITOR.instances);
                        if (instances.length > idx) {
                            instances[idx].setData(text);
                        }
                    }
                }, {idx: menilaiIframeIndex, text: menilaiText});

                // Fallback: Set innerHTML dan paksa event input (untuk fallback jika API di atas gagal)
                await menilaiBody.evaluate((el, content) => {
                    el.innerHTML = content;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, menilaiText);
                
                // 8. Simpan RPH (Pusingan 1)
                await Promise.all([
                    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                    page.getByRole('button', { name: 'Simpan RPH' }).click().catch(e => console.log('Error click Simpan:', e))
                ]);
                
                // 9. Jika Aktiviti tiada, gunakan Trik Pengguna (Buka mod Sunting dan isikan teks AI)
                if (!aktivitiFound) {
                    console.log("TRICK PENGGUNA AKTIF: Menekan butang Sunting RPH secara terus untuk mengisi baris Aktiviti...");
                    
                    // Terus tekan Sunting RPH (sepatutnya butang ini sudah ada di bawah selepas Simpan)
                    const btnSunting = page.locator('input[type="button"][value="Sunting RPH"], input[type="button"][value="Sunting"]').first();
                    try {
                        await Promise.all([
                            page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                            btnSunting.evaluate(b => b.click(), { timeout: 15000 })
                        ]);
                    } catch (e) {
                        console.log("Gagal menekan butang Sunting selepas Simpan. Senarai butang wujud:");
                        const buttons = await page.evaluate(() => {
                            return Array.from(document.querySelectorAll('input[type="button"], button, a.btn')).map(b => b.value || b.innerText || b.textContent).filter(b => b && b.trim() !== '');
                        });
                        console.log(buttons);
                        throw e; // Lontarkan ralat kembali untuk flow asal
                    }
                    
                    console.log("Berjaya masuk mod Sunting RPH.");
                    await page.waitForTimeout(2000); // Tunggu borang dimuat sepenuhnya
                    await page.waitForSelector('iframe[title="Rich Text Area"]', { state: 'attached', timeout: 30000 });
                    await page.waitForTimeout(1500);
                    
                    const secondPassIndex = await page.evaluate(() => {
                        const iframes = Array.from(document.querySelectorAll('iframe[title="Rich Text Area"]'));
                        for (let j = 0; j < iframes.length; j++) {
                            let parent = iframes[j].parentElement;
                            let distance = 0;
                            while (parent && distance < 30) {
                            if (parent.tagName === 'TR') {
                                const firstTd = parent.querySelector('td, th');
                                if (firstTd) {
                                    const text = firstTd.innerText ? firstTd.innerText.toUpperCase().trim() : '';
                                    if (text === 'AKTIVITI' || text.startsWith('AKTIVITI\n') || text === 'AKTIVITI PEMBELAJARAN') {
                                        return j;
                                    }
                                }
                            }
                                parent = parent.parentElement;
                                distance++;
                            }
                        }
                        return -1;
                    });
                    
                    if (secondPassIndex !== -1) {
                        console.log(`Baris AKTIVITI ditemui pada indeks ${secondPassIndex} semasa Sunting. Mengisi teks AI...`);
                        await injectTextToIframe(secondPassIndex, aiText);
                    } else {
                        console.log("Baris AKTIVITI MASIH TIDAK DITEMUI walaupun selepas Sunting! Memasukkan ke iframe pertama...");
                        await injectTextToIframe(0, aiText);
                    }
                    
                    // Simpan RPH Pusingan 2
                    console.log("Menyimpan RPH selepas mengisi Aktiviti...");
                    await Promise.all([
                        page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                        page.getByRole('button', { name: 'Simpan RPH' }).click()
                    ]);
                }
                console.log(`RPH Sesi ${successfulSessions + 1} Berjaya Disimpan!`);
                successfulSessions++;
                resultStats.successCount++;
                
                // Jika masih perlukan sesi seterusnya, kembali ke MIW dan buka jadual semula
                if (successfulSessions < targetSessions) {
                    console.log("Kembali ke MIW untuk sesi seterusnya...");
                    await page.goto(miwUrl);
                    await page.waitForTimeout(3000);
                    
                    await page.locator('img[src="/images/database_table.png"]').first().click(); // Buka semula jadual
                    await page.waitForTimeout(1500);
                }
            }

            } catch (classError) {
                console.error(`Ralat semasa memproses ${lesson.session_text} (mungkin RPH telah wujud):`, classError.message);
                console.log("Sistem akan meneruskan ke kelas seterusnya (jika ada)...");
                resultStats.skippedCount++;
                resultStats.errors.push(`Ralat kelas ${lesson.session_text}: ${classError.message}`);
            }
        }

    } catch (error) {
        console.error("Ralat dalam Playwright:", error);
        resultStats.errors.push(`Ralat Sistem: ${error.message}`);
    } finally {
        console.log("Menutup pelayar...");
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        
        // Bersihkan fail sementara (Chromium leak)
        if (process.env.VERCEL || process.env.AWS_REGION) {
            try {
                const tmpDir = '/tmp';
                const files = fs.readdirSync(tmpDir);
                files.forEach(file => {
                    if (file.startsWith('core.') || file.startsWith('puppeteer_dev_profile-') || file.includes('chromium')) {
                        fs.rmSync(path.join(tmpDir, file), { recursive: true, force: true });
                    }
                });
                console.log("Memori /tmp dibersihkan.");
            } catch (e) {
                console.error("Gagal membersihkan /tmp:", e);
            }
        }
        
        return resultStats;
    }
}

module.exports = { submitRPH };
