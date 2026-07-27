/**
 * /api/submit-rph.js - Vercel Serverless Function
 * 
 * NOTA: Fungsi ini menggunakan fetch() biasa (tanpa Playwright)
 * untuk submit RPH ke ASIE Model menggunakan HTTP form post.
 * 
 * Playwright TIDAK boleh digunakan di Vercel Serverless Functions
 * (hanya boleh guna @sparticuz/chromium dalam Lambda terhad).
 */

module.exports = exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const { lessons, miwDate, credentials } = req.body;

        if (!credentials || !credentials.username || !credentials.password) {
            return res.status(400).json({ success: false, error: 'Credentials (username/password) are required' });
        }
        if (!lessons || !Array.isArray(lessons) || lessons.length === 0) {
            return res.status(400).json({ success: false, error: 'Lessons array is required' });
        }

        const { username, password } = credentials;

        // Step 1: Login to asiemodel.net
        const loginBody = new URLSearchParams({
            username,
            password,
            redirect: 'main.php?cb=ms',
            language: 'en',
            view: 'home',
            submit: 'Login'
        });

        const loginRes = await fetch('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: loginBody.toString(),
            redirect: 'manual'
        });

        let rawSetCookie = '';
        if (loginRes.headers.getSetCookie) {
            rawSetCookie = loginRes.headers.getSetCookie().join('; ');
        } else {
            rawSetCookie = loginRes.headers.get('set-cookie') || '';
        }

        const sessMatch = rawSetCookie.match(/PHPSESSID=([^;]+)/i);
        const phpsessid = sessMatch ? sessMatch[1] : '';

        if (!phpsessid) {
            return res.status(401).json({
                success: false,
                error: 'Gagal log masuk ke asiemodel.net. Sila semak ID & Kata Laluan ASIE di Tetapan.'
            });
        }

        const cookieHeader = `PHPSESSID=${phpsessid}`;
        const baseHeaders = {
            'Cookie': cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        };

        // Step 2: Fetch MIW list
        const miwListRes = await fetch('https://asiemodel.net/model/search9.php?action=listmiw', {
            headers: baseHeaders
        });
        const miwListHtml = await miwListRes.text();

        // Extract MIW IDs from HTML
        const miwIds = [];
        const miwRegex = /miw9\.php\?action=openmiw&(?:amp;)?id=(\d+)/gi;
        let miwMatch;
        while ((miwMatch = miwRegex.exec(miwListHtml)) !== null) {
            if (!miwIds.includes(miwMatch[1])) {
                miwIds.push(miwMatch[1]);
            }
        }

        console.log(`[submit-rph] Found ${miwIds.length} MIW entries, processing ${lessons.length} lessons`);

        // Return success with info about what was found
        // The actual form filling happens client-side via the electron-mock.js queue
        return res.status(200).json({
            success: true,
            message: `Log masuk berjaya. Terdapat ${miwIds.length} rekod MIW di ASIE Model. Pengisian form dijalankan di peranti anda.`,
            miwCount: miwIds.length,
            lessonCount: lessons.length,
            note: 'Automasi RPH di Web App dijalankan terus dari peranti anda menggunakan kaedah iframe. Fungsi ini hanya mengesahkan log masuk.'
        });

    } catch (error) {
        console.error('[Vercel API] Error in submit-rph:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Ralat pelayan: ' + error.message 
        });
    }
};
