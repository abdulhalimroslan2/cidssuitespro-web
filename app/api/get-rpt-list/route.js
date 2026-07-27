// POST /api/get-rpt-list
// Web App Proxy to fetch RPT list from asiemodel.net
export async function POST(request) {
    try {
        const body = await request.json();
        const { credentials, username: bodyUser, password: bodyPass } = body;
        
        const username = credentials?.username || bodyUser;
        const password = credentials?.password || bodyPass;

        if (!username || !password) {
            return Response.json(
                { success: false, error: 'Sila sediakan Nama Pengguna dan Kata Laluan ASIE Model.' },
                { status: 400 }
            );
        }

        console.log(`[get-rpt-list] Logging in to asiemodel.net for user: ${username}`);

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
        
        let rawSetCookie = '';
        if (loginRes.headers.getSetCookie) {
            rawSetCookie = loginRes.headers.getSetCookie().join('; ');
        } else {
            rawSetCookie = loginRes.headers.get('set-cookie') || '';
        }
        
        const sessMatch = rawSetCookie.match(/PHPSESSID=([^;]+)/i);
        const phpsessid = sessMatch ? sessMatch[1] : '';
        
        if (!phpsessid) {
            console.error('[get-rpt-list] No PHPSESSID returned during login');
            return Response.json({
                success: false,
                error: 'Gagal log masuk ke asiemodel.net. Sila semak ID & Kata Laluan di Tetapan.'
            }, { status: 401 });
        }

        console.log('[get-rpt-list] Fetching RPT list from search9.php...');
        const searchRes = await fetch('https://asiemodel.net/model/search9.php?action=search_yearly', {
            headers: {
                'Cookie': 'PHPSESSID=' + phpsessid,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        const html = await searchRes.text();
        const rpts = [];
        const seenIds = new Set();
        
        // ASIE Model uses single quotes: href='rpt9.php?action=create_rpt&id=...'
        // Pattern: <a href='rpt9.php?action=create_rpt&id=XXXX...'>Title Text</a>
        // We use a regex that captures BOTH single and double quoted href values
        const linkRegex = /<a[^>]+href=['"]([^'"]*create_rpt[^'"]*)['"'][^>]*>([^<]+)<\/a>/gi;
        let match;
        
        while ((match = linkRegex.exec(html)) !== null) {
            const rawUrl = match[1];
            const title = match[2].trim();
            
            // Skip "Papar" links (they duplicate the named link)
            if (title.toLowerCase() === 'papar' || title.toLowerCase() === 'view') continue;
            
            // Extract RPT ID to deduplicate
            const idMatch = rawUrl.match(/[?&]id=(\d+)/);
            const rptId = idMatch ? idMatch[1] : rawUrl;
            
            if (seenIds.has(rptId)) continue;
            seenIds.add(rptId);
            
            const fullUrl = rawUrl.startsWith('http') 
                ? rawUrl 
                : 'https://asiemodel.net/model/' + rawUrl;
            
            // Only include entries with a meaningful title
            if (title && title.length > 2) {
                rpts.push({
                    title: title,
                    url: fullUrl
                });
            }
        }

        console.log(`[get-rpt-list] Found ${rpts.length} RPT items for ${username}`);
        return Response.json({ success: true, data: rpts });

    } catch (error) {
        console.error('[get-rpt-list] Error:', error);
        return Response.json({
            success: false,
            error: 'Ralat pelayan: ' + error.message
        }, { status: 500 });
    }
}
