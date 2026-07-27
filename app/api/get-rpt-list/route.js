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

        console.log('[get-rpt-list] Fetching RPT search page (search9.php)...');
        const searchRes = await fetch('https://asiemodel.net/model/search9.php?action=search_yearly', {
            headers: {
                'Cookie': 'PHPSESSID=' + phpsessid,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        const html = await searchRes.text();
        const rpts = [];
        const seenUrls = new Set();
        
        const allLinks = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
        for (const m of allLinks) {
            const url = m[1];
            let title = m[2].replace(/<[^>]+>/g, '').trim();
            if ((url.includes('create_rpt') || url.includes('rpt9.php') || url.includes('rpt.php')) && !seenUrls.has(url)) {
                seenUrls.add(url);
                let fullUrl = url.startsWith('http') ? url : 'https://asiemodel.net/model/' + url;
                
                if (!title || title.toLowerCase() === 'papar') {
                    title = 'RANCANGAN PELAJARAN TAHUNAN (RPT)';
                }

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
