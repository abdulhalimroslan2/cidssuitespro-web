const https = require('https');
function makeRequest(urlStr, options, postData = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const req = https.request({
            hostname: url.hostname, path: url.pathname + url.search,
            method: options.method || 'GET', headers: options.headers || {}
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}
async function run() {
    const commonHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    const initRes = await makeRequest('https://asiemodel.net/model/index.php', { method: 'GET', headers: commonHeaders });
    let cookies = initRes.headers['set-cookie'] || [];
    let initialPhpsessid = cookies.join('; ').match(/PHPSESSID=([^;]+)/i)?.[1] || '';
    
    const loginData = new URLSearchParams({ username: 'Roslan2', password: '@reeZ860', redirect: 'main.php?cb=ms', language: 'en', view: 'home', submit: 'Login' }).toString();
    const loginRes = await makeRequest('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', {
        method: 'POST', headers: { ...commonHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': 'PHPSESSID=' + initialPhpsessid }
    }, loginData);
    
    let finalPhpsessid = (loginRes.headers['set-cookie'] || []).join('; ').match(/PHPSESSID=([^;]+)/i)?.[1] || initialPhpsessid;
    const cookieHeader = 'PHPSESSID=' + finalPhpsessid;
    
    const listRes = await makeRequest('https://asiemodel.net/model/search9.php?action=listmiw', {
        method: 'GET', headers: { ...commonHeaders, 'Cookie': cookieHeader }
    });
    
    const matches = listRes.body.match(/miw9\.php\?action=openmiw&(?:amp;)?id=(\d+)/g) || [];
    const miwIds = [...new Set(matches.map(m => m.match(/id=(\d+)/)[1]))];
    
    let totalDeleted = 0;
    for (let miwId of miwIds) {
        console.log("Checking MIW", miwId);
        const openRes = await makeRequest(`https://asiemodel.net/model/miw9.php?action=openmiw&id=${miwId}`, {
            method: 'GET', headers: { ...commonHeaders, 'Cookie': cookieHeader }
        });
        
        const rphSet = new Set();
        const rMatches = openRes.body.match(/(?:openRPH|editRPH)&(?:amp;)?rph=(\d+)/gi) || [];
        rMatches.forEach(m => rphSet.add(m.match(/rph=(\d+)/i)[1]));
        const rphList = Array.from(rphSet);
        
        if (rphList.length > 0) {
            console.log("Found", rphList.length, "RPHs in MIW", miwId);
            for (let rphId of rphList) {
                console.log("Deleting", rphId);
                const delFormRes = await makeRequest(`https://asiemodel.net/model/rph.php?action=deleteRPH&rph=${rphId}`, {
                    method: 'GET', headers: { ...commonHeaders, 'Cookie': cookieHeader }
                });
                const delPostData = new URLSearchParams();
                const fMatch = delFormRes.body.match(/<form[^>]*id="new"[^>]*>([\s\S]*?)<\/form>/i) || delFormRes.body.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
                const fContent = fMatch ? fMatch[1] : delFormRes.body;
                const inputRegex = /<input[^>]*name=["']([^"']+)["'][^>]*>/g;
                let inp;
                while ((inp = inputRegex.exec(fContent)) !== null) {
                    const valMatch = inp[0].match(/value=["']([^"']*)["']/);
                    delPostData.append(inp[1], valMatch ? valMatch[1] : '');
                }
                delPostData.set('action', 'deleteRPH');
                delPostData.set('rph', rphId);
                delPostData.set('submit', 'Sah Hapus');
                await makeRequest('https://asiemodel.net/model/rph.php', {
                    method: 'POST',
                    headers: { ...commonHeaders, 'Cookie': cookieHeader, 'Content-Type': 'application/x-www-form-urlencoded' }
                }, delPostData.toString());
                totalDeleted++;
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }
    console.log("Total deleted:", totalDeleted);
}
run();
