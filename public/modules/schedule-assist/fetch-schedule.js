const { launchBrowser } = require('../playwright-launcher');
const path = require('path');
const fs = require('fs');

async function extractSchedule(credentials = {}) {
    const os = require('os');
    const platform = os.platform();
    const userDataPath = platform === 'win32' 
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'rph-automator')
        : (platform === 'darwin' 
            ? path.join(os.homedir(), 'Library', 'Application Support', 'rph-automator')
            : path.join(os.homedir(), '.config', 'rph-automator'));
    const authPath = path.join(userDataPath, 'auth.json');
    
    console.log("Melancarkan penyemak imbas untuk mengekstrak jadual...");
    const browser = await launchBrowser({ headless: true, channel: 'chrome' });
    let context;
    try {
        if (fs.existsSync(authPath) && !(credentials.username && credentials.password)) {
            context = await browser.newContext({ storageState: authPath });
        } else {
            context = await browser.newContext();
        }
    } catch (e) {
        context = await browser.newContext();
    }
    
    const page = await context.newPage();
    try {
        console.log("Navigasi ke ASIE Model...");
        await page.goto('https://asiemodel.net/model/main.php?cb=ms', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait for page to load
        await page.waitForTimeout(1000);
        
        // --- AUTO-LOGIN SECTION ---
        if (credentials.username && credentials.password) {
            const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="login"], input[placeholder="Login"], input[placeholder="Username"], input[placeholder*="E-mel"]').first();
            if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log(`Halaman log masuk dikesan. Log masuk sebagai ${credentials.username}...`);
                try {
                    await emailInput.fill(credentials.username);
                    const pwdInput = page.locator('input[type="password"], input[name="password"], input[placeholder="Password"]').first();
                    if (await pwdInput.isVisible()) {
                        await pwdInput.fill(credentials.password);
                        
                        // We must wait for the actual navigation to the dashboard
                        await Promise.all([
                            page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                            page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Log Masuk")').first().click()
                        ]);
                    } else {
                        await page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click();
                        await page.waitForTimeout(3000); 
                        if (await pwdInput.isVisible({ timeout: 5000 })) {
                            await pwdInput.fill(credentials.password);
                            await Promise.all([
                                page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
                                page.getByRole('button', { name: /Next|Seterusnya|Berikutnya/i }).click()
                            ]);
                        }
                    }
                    
                    // Verify if login was successful
                    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                        throw new Error("Sila semak Username dan Password.");
                    }
                    
                    console.log("Log masuk automatik selesai. Menyimpan sesi baharu...");
                    await context.storageState({ path: authPath });
                } catch(e) {
                    console.log("Ralat log masuk automatik:", e.message);
                    return { success: false, error: "Log masuk gagal: " + e.message };
                }
            }
        }

        
        // Navigasi ke Jadual Waktu
        console.log("Membuka Jadual Waktu...");
        await page.goto('https://asiemodel.net/model/teachers9.php?action=waktumengajar', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000); // Give it time to render
        
        // Extract schedule
        console.log("Mengekstrak data jadual...");
        const schedule = await page.evaluate(() => {
            const rawResults = [];
            const rows = document.querySelectorAll('li.li_row.li_sortable');
            
            rows.forEach((row, index) => {
                try {
                    // Extract Day
                    const daySelect = row.querySelector(`select[name="days[${index}]"]`);
                    let day = "";
                    if (daySelect && daySelect.options[daySelect.selectedIndex]) {
                        day = daySelect.options[daySelect.selectedIndex].text.trim();
                    }
                    
                    // Extract Class
                    const classSelect = row.querySelector(`select[name="class_id[${index}]"]`);
                    let className = "";
                    if (classSelect && classSelect.options[classSelect.selectedIndex]) {
                        className = classSelect.options[classSelect.selectedIndex].text.trim();
                    }
                    
                    // Extract Subject
                    const subjectInput = row.querySelector(`input[name="subject[${index}]"]`);
                    let subject = "";
                    let subjectValue = "";
                    if (subjectInput) {
                        subjectValue = subjectInput.value.trim();
                        // The text is usually after the hidden input in the same li
                        subject = subjectInput.parentElement.innerText.trim();
                    }
                    
                    // Extract Times
                    const startTimeInput = row.querySelector(`input[name="starttime[${index}]"]`);
                    const endTimeInput = row.querySelector(`input[name="endtime[${index}]"]`);
                    let startTime = startTimeInput ? startTimeInput.value.trim() : "";
                    let endTime = endTimeInput ? endTimeInput.value.trim() : "";
                    
                    if (day && className && subject && startTime && endTime) {
                        rawResults.push({
                            day: day,
                            className: className,
                            subject: subject,
                            subjectValue: subjectValue,
                            time: `${startTime} - ${endTime}`
                        });
                    }
                } catch (e) {
                    // Ignore errors for individual rows
                }
            });
            
            function mapSubjectId(subjectValue) {
                const s = subjectValue.toLowerCase();
                if (s.includes('math')) return 'sg_science_math-mathematics';
                if (s.includes('add_math')) return 'sg_science_math-add_math';
                if (s.includes('science')) return 'sg_science_math-science';
                if (s.includes('physics')) return 'sg_science_math-physics';
                if (s.includes('chemistry')) return 'sg_science_math-chemistry';
                if (s.includes('biology')) return 'sg_science_math-biology';
                if (s.includes('bmelayu')) return 'sg_language-bmelayu';
                if (s.includes('english')) return 'sg_language-english';
                if (s.includes('history')) return 'sg_humanities-history';
                if (s.includes('pjpk')) return 'sg_arts-pjpk';
                if (s.includes('geography')) return 'sg_humanities-geography';
                if (s.includes('rbt')) return 'sg_tech-rbt';
                if (s.includes('pi') || s.includes('pendidikan islam') || s.includes('islamic')) return 'sg_islamic-pi';
                if (s.includes('jawi')) return 'sg_islamic-jawi';
                if (s.includes('barab')) return 'sg_language-barab';
                return 'unknown_subject';
            }

            function mapClassId(className) {
                const match = className.match(/\d/);
                if (match) {
                    return `cg_secondary-form${match[0]}`;
                }
                return 'cg_secondary-form1';
            }

            const grouped = {};
            rawResults.forEach(row => {
                const key = `${row.subject}_${row.className}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        subject_id: mapSubjectId(row.subjectValue || row.subject),
                        subject_text: row.subject,
                        class_id: mapClassId(row.className),
                        session_text: row.className,
                        sessions: 1,
                        
                        // Extra info for the table preview
                        day: row.day,
                        class: row.className,
                        subject: row.subject,
                        time: row.time,
                        student_count: 30
                    };
                } else {
                    // Hanya tambah session jika ia pada hari yang berbeza
                    if (!grouped[key].day.includes(row.day)) {
                        grouped[key].sessions += 1;
                        grouped[key].day += `, ${row.day}`;
                    }
                }
            });
            
            return Object.values(grouped);
        });
        
        console.log(`Berjaya mengekstrak ${schedule.length} rekod kelas.`);
        return { success: true, schedule: schedule };
        
    } catch (e) {
        console.error("Ralat pengekstrakan:", e);
        return { success: false, error: e.message };
    } finally {
        await browser.close();
    }
}

// Allow to be run directly or imported
if (require.main === module) {
    extractSchedule().then(res => {
        console.log(JSON.stringify(res, null, 2));
    });
}

module.exports = { extractSchedule };
