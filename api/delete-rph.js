// /api/delete-rph.js - Vercel Serverless Function
// Proxy to delete RPH automatically from asiemodel.net with IP Forwarding

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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Kredensial tidak sah.' });
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        const sendLog = (msg) => {
            res.write(`data: ${JSON.stringify({ log: msg })}\n\n`);
        };
        const sendError = (msg) => {
            res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
            res.end();
        };
        const sendSuccess = () => {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
        };

        sendLog('1/4: Memulakan sambungan native (Proxy) ke ASIE Model...');

        const effectiveIp = '202.186.13.45';
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        const commonHeaders = {
            'User-Agent': userAgent,
            'X-Forwarded-For': effectiveIp,
            'X-Real-IP': effectiveIp,
            'Client-IP': effectiveIp,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        };

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

        const loginRes = await makeRequest({
            hostname: 'asiemodel.net',
            path: '/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms',
            method: 'POST',
            headers: {
                ...commonHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(loginData),
                'Cookie': initialPhpsessid ? 'PHPSESSID=' + initialPhpsessid : ''
            }
        }, loginData);

        const postCookies = loginRes.headers['set-cookie'] || [];
        const postCookieStr = Array.isArray(postCookies) ? postCookies.join('; ') : postCookies;
        const postSessMatch = postCookieStr.match(/PHPSESSID=([^;]+)/i);
        const finalPhpsessid = postSessMatch ? postSessMatch[1] : initialPhpsessid;

        const locationHeader = loginRes.headers['location'] || '';
        const loginSuccess = loginRes.statusCode === 302 || locationHeader.includes('main.php');

        if (!finalPhpsessid || !loginSuccess) {
            return sendError('Gagal log masuk ke asiemodel.net. Sila semak ID & Kata Laluan.');
        }

        const cookieHeader = 'PHPSESSID=' + finalPhpsessid;

        sendLog('2/4: Mencari rekod MIW aktif di pelayan ASIE...');
        const listRes = await makeRequest({
            hostname: 'asiemodel.net',
            path: '/model/search9.php?action=listmiw',
            method: 'GET',
            headers: { ...commonHeaders, 'Cookie': cookieHeader }
        });

        const listHtml = listRes.body || '';
        const miwMatch = listHtml.match(/miw9\.php\?action=openmiw&(?:amp;)?id=(\d+)/);
        const miwId = miwMatch ? miwMatch[1] : null;

        if (!miwId) {
            sendLog('Pemberitahuan: Tiada MIW aktif dijumpai untuk dibuang.');
            return sendSuccess();
        }

        sendLog(`3/4: Membaca senarai RPH di bawah MIW ID ${miwId}...`);
        const openRes = await makeRequest({
            hostname: 'asiemodel.net',
            path: `/model/miw9.php?action=openmiw&id=${miwId}`,
            method: 'GET',
            headers: { ...commonHeaders, 'Cookie': cookieHeader }
        });
        const openHtml = openRes.body || '';

        const rphSet = new Set();
        const matches = openHtml.match(/(?:openRPH|editRPH)&(?:amp;)?rph=(\d+)/gi) || [];
        matches.forEach(m => rphSet.add(m.match(/rph=(\d+)/i)[1]));

        const listMatches = listHtml.match(/(?:openRPH|editRPH)&(?:amp;)?rph=(\d+)/gi) || [];
        listMatches.forEach(m => rphSet.add(m.match(/rph=(\d+)/i)[1]));

        const rphList = Array.from(rphSet);
        if (rphList.length === 0) {
            sendLog('Pemberitahuan: Tiada rekod RPH wujud untuk dibuang dalam MIW ini.');
            return sendSuccess();
        }

        sendLog(`4/4: Terjumpa ${rphList.length} RPH. Memulakan pemadaman automatik...`);

        let deleted = 0;
        for (let i = 0; i < rphList.length; i++) {
            const rphId = rphList[i];
            sendLog(`  -> Membuang RPH ${i+1}/${rphList.length} (ID: ${rphId})...`);

            const delFormRes = await makeRequest({
                hostname: 'asiemodel.net',
                path: `/model/rph.php?action=deleteRPH&rph=${rphId}`,
                method: 'GET',
                headers: { ...commonHeaders, 'Cookie': cookieHeader }
            });
            const delFormHtml = delFormRes.body || '';

            const delPostData = new URLSearchParams();
            const fMatch = delFormHtml.match(/<form[^>]*id="new"[^>]*>([\s\S]*?)<\/form>/i) || delFormHtml.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
            const fContent = fMatch ? fMatch[1] : delFormHtml;

            const inputRegex = /<input[^>]*name=["']([^"']+)["'][^>]*>/g;
            let inp;
            while ((inp = inputRegex.exec(fContent)) !== null) {
                const fullTag = inp[0];
                const name = inp[1];
                const valMatch = fullTag.match(/value=["']([^"']*)["']/);
                const val = valMatch ? valMatch[1] : '';
                delPostData.append(name, val);
            }

            delPostData.set('action', 'deleteRPH');
            delPostData.set('rph', rphId);
            delPostData.set('submit', 'Sah Hapus');

            await makeRequest({
                hostname: 'asiemodel.net',
                path: '/model/rph.php',
                method: 'POST',
                headers: {
                    ...commonHeaders,
                    'Cookie': cookieHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(delPostData.toString()),
                    'Referer': `https://asiemodel.net/model/rph.php?action=deleteRPH&rph=${rphId}`
                }
            }, delPostData.toString());

            deleted++;
            sendLog(`  ✓ RPH ${i+1}/${rphList.length} (ID: ${rphId}) berjaya dibuang.`);
            
            // Add slight delay
            await new Promise(r => setTimeout(r, 500));
        }

        sendLog(`✓ Berjaya! Kesemua ${deleted}/${rphList.length} RPH telah dibuang secara automatik.`);
        sendSuccess();

    } catch (e) {
        console.error('Delete RPH proxy error:', e);
        sendError(`✖ Ralat: ${e.message}`);
    }
};
