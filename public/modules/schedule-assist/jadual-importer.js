const { launchBrowser } = require('../playwright-launcher');
const fs = require('fs');

// Fungsi pembantu untuk memilih opsyen dengan padanan kabur (fuzzy match)
async function selectOptionByText(page, selector, textToMatch) {
    const selectLocator = page.locator(selector);
    const options = await selectLocator.locator('option').all();
    let valueToSelect = null;
    // Pass 1: Exact Match (ignoring spaces and case)
    for (const option of options) {
        const rawText = await option.textContent();
        if (!rawText) continue;
        if (rawText.toLowerCase().replace(/\s+/g, '') === textToMatch.toLowerCase().replace(/\s+/g, '')) {
            valueToSelect = await option.getAttribute('value');
            break;
        }
    }

    // Pass 2: Loose Match
    if (!valueToSelect) {
        const search = textToMatch.toLowerCase().replace(/[^a-z0-9]/g, '');
        const acronyms = {
            'mm': 'matematik', 'fzk': 'fizik', 'pjk': 'jasmani', 'pj': 'jasmani', 'pk': 'kesihatan',
            'bm': 'melayu', 'bi': 'inggeris', 'sn': 'sains', 'pi': 'islam', 'pai': 'islam',
            'sej': 'sejarah', 'geo': 'geografi', 'kim': 'kimia', 'bio': 'biologi',
            'rbt': 'reka', 'ask': 'asas', 'psv': 'seni'
        };

        for (const option of options) {
            const rawText = await option.textContent();
            if (!rawText) continue;
            const opt = rawText.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            let matched = false;
            if (opt === search) matched = true;
            else if (opt.includes(search)) matched = true;
            else if (acronyms[search] && opt.includes(acronyms[search])) matched = true;
            else if (search.length === 2 && /\d[a-z]/.test(search)) {
                // Contoh "5b" -> "5bestari", "1j" -> "1jupiter"
                if (opt.startsWith(search[0]) && opt.substring(1).startsWith(search[1])) matched = true;
            }

            if (matched) {
                valueToSelect = await option.getAttribute('value');
                break;
            }
        }
    }
    
    if (valueToSelect) {
        await selectLocator.selectOption(valueToSelect);
        return true;
    }
    return false;
}

async function submitJadual(lessons, credentials) {
    console.log("Memulakan sambungan ke ASIE Model...");
    const browser = await launchBrowser({ headless: true, channel: 'chrome' }); 
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // 1. Log Masuk
        await page.goto('https://asiemodel.net/model/main.php?cb=ms', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="login"], input[placeholder="Login"], input[placeholder="Username"], input[placeholder*="E-mel"]').first();
        await emailInput.fill(credentials.username);
        
        const pwdInput = page.locator('input[type="password"], input[name="password"], input[placeholder="Password"]').first();
        if (await pwdInput.isVisible()) {
            await pwdInput.fill(credentials.password);
            await Promise.all([
                page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Log Masuk")').first().click()
            ]);
        } else {
            await page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click();
            await page.waitForTimeout(3000); 
            await pwdInput.fill(credentials.password);
            await Promise.all([
                page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click()
            ]);
        }
        console.log("Log Masuk Berjaya.");
        
        // 2. Navigasi ke Jadual Waktu
        console.log("Membuka halaman Jadual Waktu...");
        await page.goto('https://asiemodel.net/model/teachers9.php?action=waktumengajar', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000); 

        // 3. Masukkan jadual secara berturut-turut
        console.log(`Menjumlahkan jadual... Terdapat ${lessons.length} rekod.`);
        
        for (const [index, lesson] of lessons.entries()) {
            console.log(`[${index + 1}/${lessons.length}] Memasukkan: ${lesson.day} | ${lesson.time} | ${lesson.session_text} | ${lesson.subject_text}`);
            
            // Hari
            await selectOptionByText(page, '#select_weekday', lesson.day);
            
            // Kelas
            await selectOptionByText(page, '#new_teaching_period', lesson.session_text);
            
            // Kategori Subjek & Subjek
            const subjectGroup = lesson.subject_id.split('-')[0]; // cth: sg_science_math
            await page.locator('#select_subjectgroup').selectOption(subjectGroup);
            
            // Tunggu senarai subjek dimuatkan (AJAX fetch_select)
            await page.waitForTimeout(1000); 
            
            // Subjek - Pilih by ID spesifik dari AI, atau by Text
            const subjectId = lesson.subject_id.split('-')[1]; 
            const subjectSelected = await selectOptionByText(page, '#select_subject--name', lesson.subject_text);
            if (!subjectSelected && subjectId) {
                // Fallback guna value (cth: mathematics)
                await page.locator('#select_subject--name').selectOption(subjectId).catch(() => {});
            }

            // Fungsi Tukar ke AM/PM
            function formatToAmPm(timeStr) {
                if (!timeStr) return '';
                if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) return timeStr.trim().toUpperCase();
                let [hours, minutes] = timeStr.split(':');
                if (!hours || !minutes) return timeStr.trim();
                hours = parseInt(hours, 10);
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; 
                return `${hours}:${minutes.trim()} ${ampm}`;
            }

            // Masa
            const times = lesson.time.split('-');
            const startTime = formatToAmPm(times[0] ? times[0].trim() : '');
            const endTime = formatToAmPm(times[1] ? times[1].trim() : '');
            
            if (startTime) {
                await page.evaluate(`document.querySelector('#start_time').value = '${startTime}'`);
            }
            if (endTime) {
                await page.evaluate(`document.querySelector('#end_time').value = '${endTime}'`);
            }
            
            // Jumlah Waktu (sessions)
            if (lesson.sessions) {
                await page.locator('#new_period').selectOption(lesson.sessions.toString()).catch(() => {});
            }

            // Tekan Tambah
            await page.locator('#addOption_teaching_period').click();
            console.log(" - Berjaya ditekan 'Tambah'.");
            await page.waitForTimeout(1000); // Tunggu jadual dikemaskini dalam DOM
        }

        // 4. Akhir sekali, Simpan!
        console.log("Menyimpan keseluruhan jadual...");
        await page.locator('input[name="submit"][value="Simpan"]').first().click();
        
        // Tunggu proses simpan selesai
        await page.waitForTimeout(3000); 
        console.log("Jadual Waktu berjaya diimport ke dalam ASIE!");

    } catch (error) {
        console.error("Ralat Playwright:", error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = { submitJadual };
