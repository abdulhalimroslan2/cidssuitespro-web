// /api/get-rpt-list.js - Vercel Serverless Function
// Fetch RPT list from asiemodel.net via server-side proxy

async function getRptList(username, password) {
    console.log(`[get-rpt-list] Logging in for user: ${username}`);

    const loginBody = new URLSearchParams({
        username: username,
        password: password,
        redirect: 'main.php?cb=ms',
        language: 'en',
        view: 'home',
        submit: 'Login'
    });

    // Mimic a real browser as closely as possible to avoid ASIE blocking
    const browserHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Origin': 'https://asiemodel.net',
        'Referer': 'https://asiemodel.net/model/index.php',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Connection': 'keep-alive'
    };

    const loginRes = await fetch('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', {
        method: 'POST',
        headers: browserHeaders,
        body: loginBody.toString(),
        redirect: 'manual'
    });

    console.log(`[get-rpt-list] Login response status: ${loginRes.status}`);

    // Extract PHPSESSID from set-cookie header
    let rawSetCookie = '';
    if (loginRes.headers.getSetCookie) {
        const cookies = loginRes.headers.getSetCookie();
        rawSetCookie = cookies.join('; ');
        console.log(`[get-rpt-list] Cookies received: ${cookies.length}`);
    } else {
        rawSetCookie = loginRes.headers.get('set-cookie') || '';
    }

    console.log(`[get-rpt-list] Raw set-cookie snippet: ${rawSetCookie.substring(0, 100)}`);

    const sessMatch = rawSetCookie.match(/PHPSESSID=([^;,\s]+)/i);
    const phpsessid = sessMatch ? sessMatch[1] : '';

    if (!phpsessid) {
        // Try getting PHPSESSID from Location header redirect cookie
        const locationHdr = loginRes.headers.get('location') || '';
        console.error(`[get-rpt-list] No PHPSESSID. Status=${loginRes.status} Location=${locationHdr}`);
        return { 
            success: false, 
            error: 'Gagal log masuk ke asiemodel.net. Sila semak ID & Kata Laluan ASIE di menu Tetapan.',
            debug: { status: loginRes.status, location: locationHdr, cookie: rawSetCookie.substring(0, 200) }
        };
    }

    console.log(`[get-rpt-list] PHPSESSID obtained: ${phpsessid.substring(0,10)}...`);

    const searchRes = await fetch('https://asiemodel.net/model/search9.php?action=search_yearly', {
        headers: {
            'Cookie': 'PHPSESSID=' + phpsessid,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ms-MY,ms;q=0.9,en;q=0.8',
            'Referer': 'https://asiemodel.net/model/main.php',
        }
    });

    const html = await searchRes.text();
    console.log(`[get-rpt-list] search9.php response length: ${html.length}`);

    const rpts = [];
    const seenIds = new Set();

    // ASIE Model uses single-quoted href: href='rpt9.php?action=create_rpt&id=...'
    const linkRegex = /<a[^>]+href=['"]([^'"]*create_rpt[^'"]*)['"'][^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
        const rawUrl = match[1];
        const title = match[2].trim();

        // Skip "Papar" duplicate links
        if (title.toLowerCase() === 'papar' || title.toLowerCase() === 'view') continue;

        // Deduplicate by RPT ID
        const idMatch = rawUrl.match(/[?&]id=(\d+)/);
        const rptId = idMatch ? idMatch[1] : rawUrl;
        if (seenIds.has(rptId)) continue;
        seenIds.add(rptId);

        const fullUrl = rawUrl.startsWith('http')
            ? rawUrl
            : 'https://asiemodel.net/model/' + rawUrl;

        if (title && title.length > 2) {
            rpts.push({ title, url: fullUrl });
        }
    }

    console.log(`[get-rpt-list] Found ${rpts.length} RPTs for ${username}`);
    return { success: true, data: rpts };
}

module.exports = async (req, res) => {
    // CORS headers
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
        const { credentials } = req.body;

        if (!credentials || !credentials.username || !credentials.password) {
            return res.status(400).json({ success: false, error: 'Credentials (username/password) are required' });
        }

        const result = await getRptList(credentials.username, credentials.password);

        if (!result.success) {
            // Return 200 with error info (not 401) so client sees debug info
            return res.status(200).json(result);
        }

        res.status(200).json(result);

    } catch (error) {
        console.error('[get-rpt-list] Vercel error:', error);
        res.status(500).json({
            success: false,
            error: 'Ralat pelayan: ' + error.message
        });
    }
};
