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
    const listRes = await makeRequest('https://asiemodel.net/model/search9.php?action=listmiw', {
        method: 'GET', headers: { ...commonHeaders, 'Cookie': 'PHPSESSID=' + finalPhpsessid }
    });
    
    const matches = listRes.body.match(/miw9\.php\?action=openmiw&(?:amp;)?id=(\d+)/g) || [];
    console.log("MIW IDs found:", [...new Set(matches)]);
}
run();
