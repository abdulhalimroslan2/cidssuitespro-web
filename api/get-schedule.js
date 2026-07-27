// /api/get-schedule.js - Vercel Serverless Function
// Extract Jadual Waktu from ASIE Model using 3-step session flow & residential IP forwarding

const https = require('https');

function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

async function fetchScheduleFromAsie(username, password) {
    // TM Net Unifi Broadband Malaysia Residential IP
    const effectiveIp = '202.186.13.45';

    console.log(`[get-schedule] Fetching schedule for user: ${username}`);

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const commonHeaders = {
        'User-Agent': userAgent,
        'X-Forwarded-For': effectiveIp,
        'X-Real-IP': effectiveIp,
        'Client-IP': effectiveIp,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ms;q=0.8'
    };

    // Step 1: Initial GET
    const initRes = await makeRequest({
        hostname: 'asiemodel.net',
        path: '/model/index.php',
        method: 'GET',
        headers: commonHeaders
    });

    const initCookies = initRes.headers['set-cookie'] || [];
    const initCookieStr = Array.isArray(initCookies) ? initCookies.join('; ') : initCookies;
    const initSessMatch = initCookieStr.match(/PHPSESSID=([^;]+)/i);
    const initialPhpsessid = initSessMatch ? initSessMatch[1] : '';

    const loginData = new URLSearchParams({
        username: username,
        password: password,
        redirect: 'main.php?cb=ms',
        language: 'en',
        view: 'home',
        submit: 'Login'
    }).toString();

    // Step 2: POST login
    const loginRes = await makeRequest({
        hostname: 'asiemodel.net',
        path: '/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms',
        method: 'POST',
        headers: {
            ...commonHeaders,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(loginData),
            'Cookie': initialPhpsessid ? 'PHPSESSID=' + initialPhpsessid : '',
            'Origin': 'https://asiemodel.net',
            'Referer': 'https://asiemodel.net/model/index.php'
        }
    }, loginData);

    const postCookies = loginRes.headers['set-cookie'] || [];
    const postCookieStr = Array.isArray(postCookies) ? postCookies.join('; ') : postCookies;
    const postSessMatch = postCookieStr.match(/PHPSESSID=([^;]+)/i);
    const finalPhpsessid = postSessMatch ? postSessMatch[1] : initialPhpsessid;

    if (!finalPhpsessid) {
        return { success: false, error: 'Gagal log masuk ke asiemodel.net. Sila semak ID & Kata Laluan.' };
    }

    // Step 3: GET waktumengajar
    const jRes = await makeRequest({
        hostname: 'asiemodel.net',
        path: '/model/teachers9.php?action=waktumengajar',
        method: 'GET',
        headers: {
            ...commonHeaders,
            'Cookie': 'PHPSESSID=' + finalPhpsessid,
            'Referer': 'https://asiemodel.net/model/main.php'
        }
    });

    const html = jRes.body || '';
    const lineBlocks = html.split(/li_row li_sortable/).slice(1);
    const rawResults = [];

    const subjectMap = {
        'mathematics': 'Matematik', 'physics': 'Fizik', 'chemistry': 'Kimia',
        'biology': 'Biologi', 'science': 'Sains', 'arabic': 'Bahasa Arab',
        'english': 'Bahasa Inggeris', 'malay': 'Bahasa Melayu',
        'history': 'Sejarah', 'geography': 'Geografi',
        'islamic_studies': 'Pendidikan Islam', 'moral': 'Pendidikan Moral'
    };

    lineBlocks.forEach((block) => {
        try {
            let day = "";
            const dayMatch = block.match(/name="days\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/i);
            if (dayMatch) day = dayMatch[1].trim();

            let className = "";
            const classMatch = block.match(/name="class_id\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/i);
            if (classMatch) className = classMatch[1].trim();

            let subject = "";
            const subjMatch = block.match(/name="subject\[\d+\]"[^>]*value="([^"]+)"/i) || block.match(/name="subject\[\d+\]"[^>]*>([^<]+)/i);
            if (subjMatch) {
                const rawSubj = subjMatch[1].trim();
                subject = subjectMap[rawSubj] || rawSubj;
            }

            let startTime = "";
            let endTime = "";
            const startMatch = block.match(/name="starttime\[\d+\]"[^>]*value="([^"]+)"/i);
            const endMatch = block.match(/name="endtime\[\d+\]"[^>]*value="([^"]+)"/i);
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

    console.log(`[get-schedule] Extracted ${rawResults.length} schedule items for ${username}`);
    return { success: true, schedule: rawResults };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const { credentials, username: bodyUser, password: bodyPass } = req.body || {};
        const username = credentials?.username || bodyUser;
        const password = credentials?.password || bodyPass;

        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Credentials (username/password) are required' });
        }

        const result = await fetchScheduleFromAsie(username, password);
        res.status(200).json(result);

    } catch (error) {
        console.error('[get-schedule] Vercel error:', error);
        res.status(500).json({
            success: false,
            error: 'Ralat pelayan: ' + error.message
        });
    }
};
