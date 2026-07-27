const { launchBrowser } = require('../playwright-launcher');
const { generateRPH } = require('./ai-generator');
const fs = require('fs');
const path = require('path');

async function submitRPH(lessons, credentials = {}, apiKey = null) {
    const os = require('os');
    const platform = os.platform();
    const userDataPath = platform === 'win32' 
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'rph-automator')
        : (platform === 'darwin' 
            ? path.join(os.homedir(), 'Library', 'Application Support', 'rph-automator')
            : path.join(os.homedir(), '.config', 'rph-automator'));
    
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
    const browser = await launchBrowser({ headless: false, channel: 'chrome' }); 
    const context = await browser.newContext({ storageState: authPath });
    const page = await context.newPage();

    try {
        console.log("Membuka ASIE Model...");
        
        // --- AUTO-LOGIN SECTION ---
        await page.goto('https://asiemodel.net/model/main.php?cb=ms');
        await page.waitForTimeout(2000); // Tunggu redirect jika ada
        
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
                        // Anggap sebagai Google Sign In (perlu klik Next)
                        await page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click();
                        await page.waitForTimeout(3000); 
                        if (await pwdInput.isVisible({ timeout: 5000 })) {
                            await pwdInput.fill(credentials.password);
                            await page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click();
                        }
                    }
                    
                    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
                    console.log("Log masuk automatik selesai. Menyimpan sesi baharu...");
                    await context.storageState({ path: authPath });
                    
                    // Pergi semula ke halaman utama selepas login
                    await page.goto('https://asiemodel.net/model/main.php?cb=ms');
                } catch(e) {
                    console.log("Log masuk automatik tidak berjaya, meneruskan dengan harapan sesi masih aktif: " + e.message);
                }
            }
        }
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
                await page.goto('https://asiemodel.net/model/main.php?cb=ms');
                await page.getByRole('link', { name: 'eRPH' }).click();
                await page.getByRole('link', { name: 'Buka Rekod' }).click();
                await page.waitForTimeout(1500);
            
            // 1. Pilih Kelas dan Subjek
            await page.locator('#select_classlevel').selectOption(lesson.class_id);
            
            // Padanan pintar (Smart Matching) untuk subjek
            const subjectOptions = await page.locator('#select_subject option').evaluateAll(opts => 
                opts.map(o => ({ value: o.value, text: o.text.trim() }))
            );
            
            let matchedValue = null;
            const targetId = lesson.subject_id;
            
            // Cubaan 1: Cari padanan tepat (exact value match)
            const exactMatch = subjectOptions.find(o => o.value === targetId);
            if (exactMatch) {
                matchedValue = exactMatch.value;
            } else {
                // Cubaan 2: Cari padanan teks (label match)
                const textMatch = subjectOptions.find(o => 
                    o.text.toLowerCase() === targetId.toLowerCase() || 
                    o.text.toLowerCase().includes(targetId.toLowerCase().replace('sg_language-', '').replace('sg_science_math-', ''))
                );
                
                if (textMatch) {
                    matchedValue = textMatch.value;
                    console.log(`[Pintar] Menukar ${targetId} kepada ${matchedValue} (${textMatch.text})`);
                } else {
                    // Cubaan 3: Fallback ke carian fuzzy yang sangat longgar
                    const fuzzyMatch = subjectOptions.find(o => {
                        const sText = o.text.toLowerCase();
                        if (targetId.includes('melayu') && sText.includes('melayu')) return true;
                        if ((targetId.includes('sains') || targetId.includes('science')) && sText.includes('sains')) return true;
                        if ((targetId.includes('matematik') || targetId.includes('mathematics')) && sText.includes('matematik')) return true;
                        if (targetId.includes('inggeris') && sText.includes('inggeris')) return true;
                        if (targetId.includes('english') && sText.includes('inggeris')) return true;
                        if ((targetId.includes('sejarah') || targetId.includes('history')) && sText.includes('sejarah')) return true;
                        if (targetId.includes('jawi') && sText.includes('jawi')) return true;
                        if (targetId.includes('arab') && sText.includes('arab')) return true;
                        return false;
                    });
                    
                    if (fuzzyMatch) {
                        matchedValue = fuzzyMatch.value;
                        console.log(`[Fuzzy] Menukar ${targetId} kepada ${matchedValue} (${fuzzyMatch.text})`);
                    }
                }
            }
            
            let finalSubjectText = "";
            if (matchedValue) {
                await page.locator('#select_subject').selectOption(matchedValue);
                const selectedSubjectText = await page.locator('#select_subject option:checked').textContent();
                finalSubjectText = selectedSubjectText.trim();
            } else {
                console.error(`Amaran: Subjek "${targetId}" tidak ditemui dalam senarai dropdown ASIE. Melangkau...`);
                // Pilih apa-apa subjek secara lalai atau biarkan ralat berlaku
                try {
                    await page.locator('#select_subject').selectOption({ index: 1 });
                } catch(e) {}
            }
            
            await page.getByRole('button', { name: 'Cari' }).click();
            
            // 2. Klik pautan MIW (Berdasarkan tarikh mingguan di dalam rekod)
            console.log(`Mencari pautan MIW untuk tarikh: ${lesson.miw_date}`);
            const miwLink = page.locator('tr').filter({ hasText: lesson.miw_date }).getByRole('link', { name: 'MIW' }).first();
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
            await page.waitForTimeout(1000); // Tunggu jadual pop-up muncul
            
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
                if (subjLower && text.includes(subjLower)) match = true;
                else if (subjLower) {
                    // Fuzzy match untuk subjek (singkatan dsb)
                    const subjekKataKunci = subjLower.split(/\s+/).filter(w => w.length > 3);
                    if (subjekKataKunci.length > 0 && subjekKataKunci.some(w => text.includes(w))) {
                        match = true;
                    }
                    // Hardcoded fallbacks untuk subjek popular yang sering disingkatkan
                    if (targetId.includes('pjpk') && (text.includes('pjpk') || text.includes('jasmani'))) match = true;
                    if (targetId.includes('pendidikan islam') && text.includes('pi')) match = true;
                    if (targetId.includes('sains') && text.includes('sains')) match = true;
                } else {
                    match = true;
                }
                
                if(match) {
                    targetSlotIndices.push(j);
                }
            }
            
            let totalSlots = targetSlotIndices.length;
            
            if (totalSlots === 0 && slotCount > 0) {
                 for(let j=0; j<slotCount; j++) targetSlotIndices.push(j);
                 totalSlots = targetSlotIndices.length;
            }

            const maxSessions = lesson.sessions || 1;
            const targetSessions = Math.min(totalSlots, maxSessions);
            
            if (targetSessions === 0) {
                console.log(`Tiada slot jadual dijumpai untuk ${lesson.session_text}. Melangkau...`);
                await page.keyboard.press('Escape');
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
                console.log(`\n--- Menjana RPH untuk Sesi ${successfulSessions + 1} (${lesson.session_text} - Slot ke-${i+1}) ---`);
                
                // Klik pada kotak subjek (Guna slotIndex yang telah ditapis)
            await allClassSlots.nth(slotIndex).click({ force: true });
            
            // Tunggu modal ANALISIS (atau modal berkaitan) muncul
            await page.waitForTimeout(1500);
            
            // --- LOGIK PENGAGIHAN TICK STANDARD PEMBELAJARAN (DI DALAM MODAL MIW) ---
            console.log(`Menyemak kotak pilihan (checkbox) Standard Pembelajaran di modal MIW untuk agihan Sesi ${successfulSessions + 1}...`);
            await page.evaluate(({ sessionIndex, targetSessions }) => {
                // 1. Cari elemen teks "STANDARD PEMBELAJARAN" yang terakhir (kerana ia adalah bahagian paling bawah)
                const allElements = Array.from(document.querySelectorAll('*'));
                let stdHeaderIndex = -1;
                
                for (let i = allElements.length - 1; i >= 0; i--) {
                    if (allElements[i].children.length === 0 && allElements[i].textContent.trim().toUpperCase() === 'STANDARD PEMBELAJARAN') {
                        stdHeaderIndex = i;
                        break;
                    }
                }
                
                let targetCheckboxes = [];
                if (stdHeaderIndex !== -1) {
                    // 2. Kumpul semua checkbox selepas tajuk tersebut
                    for (let i = stdHeaderIndex + 1; i < allElements.length; i++) {
                        const el = allElements[i];
                        if (el.tagName === 'INPUT' && el.type === 'checkbox') {
                            // Pastikan ia visible
                            if (el.getBoundingClientRect().width > 0 || el.offsetParent !== null) {
                                targetCheckboxes.push(el);
                            }
                        }
                    }
                }
                
                // Jika cara di atas gagal, cuba guna regex untuk cari label berangka (cth: 1.1.1)
                if (targetCheckboxes.length === 0) {
                    const allCbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                    targetCheckboxes = allCbs.filter(cb => {
                        const parentText = cb.parentElement?.textContent || '';
                        const nextText = cb.nextSibling?.textContent || '';
                        // Cari teks yang mempunyai corak bernombor seperti 1.1.1
                        return /\d+\.\d+\.\d+/.test(parentText) || /\d+\.\d+\.\d+/.test(nextText);
                    });
                }
                
                // Jika masih gagal, ambil semua checkbox dan abaikan 3 yang pertama (Bidang, Tajuk, Kandungan)
                if (targetCheckboxes.length === 0) {
                    const allCbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                    if (allCbs.length > 3) {
                        targetCheckboxes = allCbs.slice(3); // Ambil baki sebagai Standard Pembelajaran
                    }
                }
                
                if (targetCheckboxes.length > 1 && targetSessions > 1) {
                    const N = targetCheckboxes.length;
                    const S = targetSessions;
                    const chunks = Array.from({ length: S }, () => []);
                    const baseSize = Math.floor(N / S);
                    const remainder = N % S;
                    let itemIndex = 0;
                    
                    // Bahagikan indeks checkbox kepada chunks
                    for (let j = 0; j < S; j++) {
                        let size = baseSize + (j < remainder ? 1 : 0);
                        for (let k = 0; k < size; k++) {
                            chunks[j].push(itemIndex++);
                        }
                    }
                    
                    const myChunk = chunks[sessionIndex] || [];
                    
                    // Tick yang sepatutnya ditick, Untick yang sepatutnya diuntick
                    for (let j = 0; j < N; j++) {
                        const cb = targetCheckboxes[j];
                        if (!cb.disabled) {
                            const shouldBeChecked = myChunk.includes(j);
                            if (shouldBeChecked && !cb.checked) {
                                cb.click(); // Tick
                            } else if (!shouldBeChecked && cb.checked) {
                                cb.click(); // Untick
                            }
                        }
                    }
                }
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

                let navigated = false;
                try {
                    if (await page.getByRole('button', { name: 'Cipta RPH' }).isVisible({ timeout: 2000 }).catch(() => false)) {
                        await Promise.all([
                            page.waitForNavigation({ timeout: 10000 }),
                            page.getByRole('button', { name: 'Cipta RPH' }).click()
                        ]);
                        navigated = true;
                    } else if (await page.getByRole('button', { name: 'Sunting RPH' }).isVisible({ timeout: 2000 }).catch(() => false)) {
                        await Promise.all([
                            page.waitForNavigation({ timeout: 10000 }),
                            page.getByRole('button', { name: 'Sunting RPH' }).click()
                        ]);
                        navigated = true;
                    }
                } catch (navErr) {
                    console.log(`Tiada navigasi berlaku untuk slot ke-${i+1} (Mungkin slot bergabung). Melangkau ke slot seterusnya...`);
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
                    console.log("Menjana RPH menggunakan AI...");
                    aiText = await generateRPH(lesson, i, apiKey); // Hantar indeks sesi dan apiKey ke AI
                }
                
                // 7. Masukkan teks AI ke dalam editor 'Pemudahcaraan & Pelibatan Pelajar'
                console.log("Menyalin teks AI ke dalam borang...");
                
                const iframeIndex = await page.evaluate(() => {
                    const iframes = Array.from(document.querySelectorAll('iframe[title="Rich Text Area"]'));
                    for (let j = 0; j < iframes.length; j++) {
                        let parent = iframes[j].parentElement;
                        let distance = 0;
                        while (parent && distance < 15) {
                            if (parent.innerText && parent.innerText.toUpperCase().includes('PEMUDAHCARAAN')) {
                                return j;
                            }
                            parent = parent.parentElement;
                            distance++;
                        }
                    }
                    return 0; // fallback ke iframe pertama jika tak jumpa
                });
                
                console.log(`Menggunakan iframe index: ${iframeIndex} untuk Pemudahcaraan.`);
                const richTextBody = page.locator('iframe[title="Rich Text Area"]').nth(iframeIndex).contentFrame().locator('body');
                
                // Tunggu 'body' di dalam iframe wujud secara fizikal untuk elak ralat kelajuan internet
                await richTextBody.waitFor({ state: 'attached', timeout: 30000 });
                await richTextBody.evaluate((el, content) => el.innerHTML = content, aiText);

                // 7.5 Isi bahagian Menilai dengan Refleksi Custom
                console.log("Mengisi ruangan MENILAI dengan refleksi khusus...");
                let xTotal = 30; // default
                const sName = lesson.session_text.toUpperCase();
                if (sName.includes('5 BUKHARI')) xTotal = 30;
                else if (sName.includes('5 FARABI')) xTotal = 29;
                else if (sName.includes('4 FARABI')) xTotal = 32;
                else if (sName.includes('2 BUKHARI')) xTotal = 28;
                else if (sName.includes('2 JABIR')) xTotal = 28;

                const yRand = Math.floor(Math.random() * (15 - 9 + 1)) + 9;
                const menilaiText = `<p>${xTotal} orang murid mencapai dan menguasai semua Objektif Pembelajaran ditetapkan oleh Standard Pembelajaran. ${yRand} orang murid perlu penerangan lanjutan dan telah diberi pentaksiran lisan serta diberi bimbingan bagi mencapai dan menguasai semua Objektif Pembelajaran pada hari ini.</p>`;

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
                await menilaiBody.evaluate((el, content) => el.innerHTML = content, menilaiText);
                
                // 8. Simpan RPH
                await Promise.all([
                    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                    page.getByRole('button', { name: 'Simpan RPH' }).click()
                ]);
                console.log(`RPH Sesi ${successfulSessions + 1} Berjaya Disimpan!`);
                successfulSessions++;
                
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
            }
        }

    } catch (error) {
        console.error("Ralat dalam Playwright:", error);
    } finally {
        console.log("Menutup pelayar...");
        await browser.close();
    }
}

module.exports = { submitRPH };
