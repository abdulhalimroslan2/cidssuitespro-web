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

    const loginRes = await fetch('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: loginBody.toString(),
        redirect: 'manual'
    });

    // Extract PHPSESSID from set-cookie header
    let rawSetCookie = '';
    if (loginRes.headers.getSetCookie) {
        rawSetCookie = loginRes.headers.getSetCookie().join('; ');
    } else {
        rawSetCookie = loginRes.headers.get('set-cookie') || '';
    }

    const sessMatch = rawSetCookie.match(/PHPSESSID=([^;]+)/i);
    const phpsessid = sessMatch ? sessMatch[1] : '';

    if (!phpsessid) {
        console.error('[get-rpt-list] No PHPSESSID — login failed for user:', username);
        return { success: false, error: 'Gagal log masuk ke asiemodel.net. Sila semak ID & Kata Laluan di Tetapan.' };
    }

    console.log('[get-rpt-list] Login OK. Fetching search9.php...');
    const searchRes = await fetch('https://asiemodel.net/model/search9.php?action=search_yearly', {
        headers: {
            'Cookie': 'PHPSESSID=' + phpsessid,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
    });

    const html = await searchRes.text();
    const rpts = [];
    const seenIds = new Set();

    // ASIE Model uses single-quoted href: href='rpt9.php?action=create_rpt&id=...'
    // This regex handles BOTH single and double quotes
    const linkRegex = /<a[^>]+href=['"]([^'"]*create_rpt[^'"]*)['"'][^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
        const rawUrl = match[1];
        const title = match[2].trim();

        // Skip "Papar" button links — they duplicate the named RPT link
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
            return res.status(401).json(result);
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
