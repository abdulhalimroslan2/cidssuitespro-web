// /api/get-rpt-list.js - Vercel Serverless Function
// Proxy to fetch RPT list from asiemodel.net with IP Forwarding (X-Forwarded-For / X-Real-IP)

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

async function getRptList(username, password, clientIp) {
    // Malaysian residential IP pool fallback (TM Net Unifi)
    const effectiveIp = (clientIp && !clientIp.includes('127.0.0.1') && !clientIp.includes('::1'))
        ? clientIp.split(',')[0].trim()
        : '202.186.13.45';

    console.log(`[get-rpt-list] IP Forwarding enabled for user: ${username} (Effective IP: ${effectiveIp})`);

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    const commonHeaders = {
        'User-Agent': userAgent,
        'X-Forwarded-For': effectiveIp,
        'X-Real-IP': effectiveIp,
        'Client-IP': effectiveIp,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ms;q=0.8'
    };

    // Step 1: Initial GET to obtain session cookie
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

    console.log(`[get-rpt-list] Step 1 status=${initRes.statusCode}, session=${initialPhpsessid ? initialPhpsessid.substring(0,8) : 'NONE'}`);

    const loginData = new URLSearchParams({
        username: username,
        password: password,
        redirect: 'main.php?cb=ms',
        language: 'en',
        view: 'home',
        submit: 'Login'
    }).toString();

    // Step 2: POST login WITH IP headers and session cookie
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

    console.log(`[get-rpt-list] Step 2 status=${loginRes.statusCode}, finalSession=${finalPhpsessid ? finalPhpsessid.substring(0,8) : 'NONE'}`);

    if (!finalPhpsessid) {
        return { 
            success: false, 
            error: 'Gagal log masuk ke asiemodel.net. Sila semak ID & Kata Laluan ASIE di menu Tetapan.',
            debug: { initStatus: initRes.statusCode, loginStatus: loginRes.statusCode }
        };
    }

    // Step 3: GET search9.php
    const searchRes = await makeRequest({
        hostname: 'asiemodel.net',
        path: '/model/search9.php?action=search_yearly',
        method: 'GET',
        headers: {
            ...commonHeaders,
            'Cookie': 'PHPSESSID=' + finalPhpsessid,
            'Referer': 'https://asiemodel.net/model/main.php'
        }
    });

    console.log(`[get-rpt-list] Step 3 status=${searchRes.statusCode}, bodyLength=${searchRes.body ? searchRes.body.length : 0}`);

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

    console.log(`[get-rpt-list] Found ${rpts.length} RPTs for ${username}`);
    return { success: true, data: rpts };
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

        // Extract client IP from incoming request headers
        const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress;

        const result = await getRptList(username, password, clientIp);
        res.status(200).json(result);

    } catch (error) {
        console.error('[get-rpt-list] Vercel error:', error);
        res.status(500).json({
            success: false,
            error: 'Ralat pelayan: ' + error.message
        });
    }
};
