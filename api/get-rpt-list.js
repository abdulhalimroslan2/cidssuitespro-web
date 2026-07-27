async function getRptList(username, password) {
    console.log('Logging into asiemodel.net via HTTP fetch...');
    const loginBody = new URLSearchParams({
        username: username,
        password: password,
        redirect: 'main.php?cb=ms',
        language: 'en',
        view: 'home',
        submit: 'Login'
    });
    
    const res1 = await fetch('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: loginBody.toString(),
        redirect: 'manual'
    });
    
    let rawSetCookie = '';
    if (res1.headers.getSetCookie) {
        rawSetCookie = res1.headers.getSetCookie().join('; ');
    } else {
        rawSetCookie = res1.headers.get('set-cookie') || '';
    }
    
    const sessMatch = rawSetCookie.match(/PHPSESSID=([^;]+)/i);
    const phpsessid = sessMatch ? sessMatch[1] : '';
    
    if (!phpsessid) {
        console.error('No PHPSESSID cookie returned during login for user:', username);
        return [];
    }

    console.log('Fetching RPT search page (search9.php)...');
    const res2 = await fetch('https://asiemodel.net/model/search9.php?action=search_yearly', {
        headers: {
            'Cookie': 'PHPSESSID=' + phpsessid,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
    });
    
    const html = await res2.text();
    const rpts = [];
    const seenUrls = new Set();
    
    const allLinks = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    for (const m of allLinks) {
        const url = m[1];
        let title = m[2].replace(/<[^>]+>/g, '').trim();
        if ((url.includes('create_rpt') || url.includes('rpt9.php') || url.includes('rpt.php')) && !seenUrls.has(url)) {
            seenUrls.add(url);
            let fullUrl = url.startsWith('http') ? url : 'https://asiemodel.net/model/' + url;
            rpts.push({
                title: title || fullUrl,
                url: fullUrl
            });
        }
    }
    
    return rpts;
}

// Simple test wrapper
if (require.main === module) {
    (async () => {
        try {
            const rpts = await getRptList('Roslan2', '@reeZ860');
            console.log('RPTs:', rpts);
        } catch (e) {
            console.error('Test failed:', e);
        }
    })();
}

module.exports = async (req, res) => {
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
        const { credentials } = req.body;
        
        if (!credentials || !credentials.username || !credentials.password) {
            return res.status(400).json({ success: false, error: 'Credentials (username/password) are required' });
        }

        const rpts = await getRptList(credentials.username, credentials.password);
        res.status(200).json({ success: true, data: rpts });
    } catch (error) {
        console.error('[Vercel API] Error in get-rpt-list:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ralat pelayan Vercel: ' + error.message 
        });
    }
};
