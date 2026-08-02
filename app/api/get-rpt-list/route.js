// POST /api/get-rpt-list
// Direct server-to-ASIE with multiple strategies to bypass Cloudflare
// Strategy 1: Direct fetch with browser-like headers
// Strategy 2: Follow Cloudflare challenge if possible

export const maxDuration = 60;

async function loginToASIE(username, password) {
  const ua = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36';
  
  // Step 1: Initial GET to obtain session cookie
  const initRes = await fetch('https://asiemodel.net/model/index.php', {
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-MY,en;q=0.9,ms-MY;q=0.8,ms;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="126", "Not/A)Brand";v="8", "Google Chrome";v="126"',
      'Sec-Ch-Ua-Mobile': '?1',
      'Sec-Ch-Ua-Platform': '"Android"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'manual',
  });

  // Extract PHPSESSID
  const cookies = initRes.headers.getSetCookie?.() || [];
  const cookieStr = cookies.join('; ');
  const sessMatch = cookieStr.match(/PHPSESSID=([^;]+)/i);
  const initPhpsessid = sessMatch ? sessMatch[1] : '';
  
  // Check if Cloudflare challenge was returned
  const initBody = await initRes.text();
  const isCFChallenge = initBody.includes('cf_chl_opt') || initBody.includes('challenge-platform');
  
  if (isCFChallenge) {
    // Cloudflare is blocking — return error with clear message
    return { success: false, cfBlocked: true };
  }

  // Step 2: POST login
  const loginBody = new URLSearchParams({
    username, password,
    redirect: 'main.php?cb=ms',
    language: 'en', view: 'home', submit: 'Login'
  });

  const loginRes = await fetch('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': initPhpsessid ? 'PHPSESSID=' + initPhpsessid : '',
      'User-Agent': ua,
      'Origin': 'https://asiemodel.net',
      'Referer': 'https://asiemodel.net/model/index.php',
      'Sec-Ch-Ua': '"Chromium";v="126", "Not/A)Brand";v="8", "Google Chrome";v="126"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
    },
    body: loginBody.toString(),
    redirect: 'manual',
  });

  const postCookies = loginRes.headers.getSetCookie?.() || [];
  const postCookieStr = postCookies.join('; ');
  const postSessMatch = postCookieStr.match(/PHPSESSID=([^;]+)/i);
  const finalPhpsessid = postSessMatch ? postSessMatch[1] : initPhpsessid;
  
  const location = loginRes.headers.get('location') || '';
  const loginSuccess = loginRes.status === 302 || location.includes('main.php');

  return { success: loginSuccess, phpsessid: finalPhpsessid };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, username: bu, password: bp } = body || {};
    const username = credentials?.username || bu;
    const password = credentials?.password || bp;

    if (!username || !password) {
      return Response.json({ success: false, error: 'Sila sediakan Nama Pengguna dan Kata Laluan ASIE Model.' }, { status: 400 });
    }

    const login = await loginToASIE(username, password);
    
    if (login.cfBlocked) {
      return Response.json({
        success: false,
        error: 'Cloudflare sedang menyekat akses dari pelayan web. Sila gunakan aplikasi desktop/Android CIDS Suites Pro untuk mengakses ASIE Model, atau cuba semula dalam beberapa minit.',
        cfBlocked: true,
      });
    }

    if (!login.success || !login.phpsessid) {
      return Response.json({
        success: false,
        error: 'Login ke ASIE Model gagal. Sila semak nama pengguna dan kata laluan di Setting.'
      });
    }

    // Step 3: Fetch RPT list
    const ua = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36';
    const searchRes = await fetch('https://asiemodel.net/model/search9.php?action=search_yearly', {
      headers: {
        'Cookie': 'PHPSESSID=' + login.phpsessid,
        'User-Agent': ua,
        'Referer': 'https://asiemodel.net/model/main.php',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
      }
    });

    const html = await searchRes.text();
    
    // Check if search page also got CF challenge
    if (html.includes('cf_chl_opt') || html.includes('challenge-platform')) {
      return Response.json({
        success: false,
        error: 'Cloudflare menyekat halaman senarai RPT. Sila gunakan aplikasi desktop/Android.',
        cfBlocked: true,
      });
    }

    const linkRegex = /<a[^>]+href=['"]([^'"]*create_rpt[^'"]*)['"][^>]*>([^<]+)<\/a>/gi;
    let match;
    const rpts = [];
    const seenIds = new Set();
    while ((match = linkRegex.exec(html)) !== null) {
      const rawUrl = match[1];
      const title = match[2].trim();
      if (title.toLowerCase() === 'papar' || title.toLowerCase() === 'view') continue;
      const idMatch = rawUrl.match(/[?&]id=(\d+)/);
      const rptId = idMatch ? idMatch[1] : rawUrl;
      if (seenIds.has(rptId)) continue;
      seenIds.add(rptId);
      const fullUrl = rawUrl.startsWith('http') ? rawUrl : 'https://asiemodel.net/model/' + rawUrl;
      if (title && title.length > 2) rpts.push({ title, url: fullUrl });
    }

    return Response.json({ success: true, data: rpts });

  } catch (error) {
    console.error('[get-rpt-list] Error:', error);
    return Response.json({ success: false, error: 'Ralat pelayan: ' + error.message }, { status: 500 });
  }
}
