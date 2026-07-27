// POST /api/get-rpt-list
// Web App Proxy to fetch RPT list from asiemodel.net using native Node https module

import https from 'https';

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

export async function POST(request) {
    try {
        const body = await request.json();
        const { credentials, username: bodyUser, password: bodyPass } = body || {};
        
        const username = credentials?.username || bodyUser;
        const password = credentials?.password || bodyPass;

        if (!username || !password) {
            return Response.json(
                { success: false, error: 'Sila sediakan Nama Pengguna dan Kata Laluan ASIE Model.' },
                { status: 400 }
            );
        }

        console.log(`[get-rpt-list Route] Logging in via https module for user: ${username}`);

        const loginData = new URLSearchParams({
            username: username,
            password: password,
            redirect: 'main.php?cb=ms',
            language: 'en',
            view: 'home',
            submit: 'Login'
        }).toString();

        const loginRes = await makeRequest({
            hostname: 'asiemodel.net',
            path: '/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(loginData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Origin': 'https://asiemodel.net',
                'Referer': 'https://asiemodel.net/model/index.php'
            }
        }, loginData);

        const setCookieHeader = loginRes.headers['set-cookie'] || [];
        const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
        const sessMatch = cookieStr.match(/PHPSESSID=([^;]+)/i);
        const phpsessid = sessMatch ? sessMatch[1] : '';

        if (!phpsessid) {
            console.error(`[get-rpt-list Route] No PHPSESSID returned. Status=${loginRes.statusCode}`);
            return Response.json({
                success: false,
                error: 'Gagal log masuk ke asiemodel.net. Sila semak ID & Kata Laluan di Tetapan.'
            }, { status: 401 });
        }

        console.log(`[get-rpt-list Route] PHPSESSID obtained. Fetching search9.php...`);

        const searchRes = await makeRequest({
            hostname: 'asiemodel.net',
            path: '/model/search9.php?action=search_yearly',
            method: 'GET',
            headers: {
                'Cookie': 'PHPSESSID=' + phpsessid,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': 'https://asiemodel.net/model/main.php'
            }
        });

        const linkRegex = /<a[^>]+href=['"]([^'"]*create_rpt[^'"]*)['"'][^>]*>([^<]+)<\/a>/gi;
        let match;
        const rpts = [];
        const seenIds = new Set();

        while ((match = linkRegex.exec(searchRes.body)) !== null) {
            const rawUrl = match[1];
            const title = match[2].trim();
            if (title.toLowerCase() === 'papar' || title.toLowerCase() === 'view') continue;
            const idMatch = rawUrl.match(/[?&]id=(\d+)/);
            const rptId = idMatch ? idMatch[1] : rawUrl;
            if (seenIds.has(rptId)) continue;
            seenIds.add(rptId);
            const fullUrl = rawUrl.startsWith('http') ? rawUrl : 'https://asiemodel.net/model/' + rawUrl;
            if (title && title.length > 2) {
                rpts.push({ title, url: fullUrl });
            }
        }

        console.log(`[get-rpt-list Route] Found ${rpts.length} RPTs for ${username}`);
        return Response.json({ success: true, data: rpts });

    } catch (error) {
        console.error('[get-rpt-list Route] Error:', error);
        return Response.json({
            success: false,
            error: 'Ralat pelayan: ' + error.message
        }, { status: 500 });
    }
}
