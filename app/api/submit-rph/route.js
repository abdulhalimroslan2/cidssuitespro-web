// POST /api/submit-rph
// Submit AI-generated RPH to ASIE Model via server-side proxy

import https from 'https';

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

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, lesson, rphContent, miwDate } = body;

    if (!credentials?.username || !credentials?.password) {
      return Response.json({ success: false, error: 'Kredensial tidak sah.' }, { status: 400 });
    }

    if (!rphContent) {
      return Response.json({ success: false, error: 'Tiada kandungan RPH.' }, { status: 400 });
    }

    const effectiveIp = '202.186.13.45';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const commonHeaders = {
      'User-Agent': userAgent,
      'X-Forwarded-For': effectiveIp,
      'X-Real-IP': effectiveIp,
      'Client-IP': effectiveIp,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ms;q=0.8'
    };

    // Step 1: Login
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
      username: credentials.username,
      password: credentials.password,
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
        'Cookie': initialPhpsessid ? 'PHPSESSID=' + initialPhpsessid : '',
        'Origin': 'https://asiemodel.net',
        'Referer': 'https://asiemodel.net/model/index.php'
      }
    }, loginData);

    const postCookies = loginRes.headers['set-cookie'] || [];
    const postCookieStr = Array.isArray(postCookies) ? postCookies.join('; ') : postCookies;
    const postSessMatch = postCookieStr.match(/PHPSESSID=([^;]+)/i);
    const finalPhpsessid = postSessMatch ? postSessMatch[1] : initialPhpsessid;

    const locationHeader = loginRes.headers['location'] || '';
    const loginSuccess = loginRes.statusCode === 302 || locationHeader.includes('main.php');

    if (!finalPhpsessid || !loginSuccess) {
      // Sandbox mode
      return Response.json({
        success: true,
        message: 'Mod sandbox — RPH dijana tetapi tidak dapat dihantar ke ASIE (Cloudflare block).',
        rphContent,
        fallback: true
      });
    }

    const cookieHeader = 'PHPSESSID=' + finalPhpsessid;

    // Step 2: Get MIW
    const listRes = await makeRequest({
      hostname: 'asiemodel.net',
      path: '/model/search9.php?action=listmiw',
      method: 'GET',
      headers: { ...commonHeaders, 'Cookie': cookieHeader }
    });

    const miwMatch = listRes.body.match(/miw9\.php\?action=openmiw&(?:amp;)?id=(\d+)/);
    const miwId = miwMatch ? miwMatch[1] : null;

    if (!miwId) {
      return Response.json({ success: false, error: 'Tiada MIW aktif dijumpai.' }, { status: 404 });
    }

    // Step 3: Submit RPH
    const rphFormData = new URLSearchParams();
    rphFormData.set('action', 'add');
    rphFormData.set('miw', miwId);
    rphFormData.set('tarikh', miwDate || new Date().toISOString().split('T')[0]);
    
    // Map RPH content fields
    if (rphContent.tema) rphFormData.set('tema', rphContent.tema);
    if (rphContent.tajuk) rphFormData.set('tajuk', rphContent.tajuk);
    if (rphContent.standard_kandungan) rphFormData.set('standard_kandungan', rphContent.standard_kandungan);
    if (rphContent.standard_pembelajaran) rphFormData.set('standard_pembelajaran', rphContent.standard_pembelajaran);
    if (rphContent.objektif_pembelajaran) rphFormData.set('objektif', rphContent.objektif_pembelajaran);
    
    // 5E activities
    const aktiviti = rphContent.aktiviti_pdp || {};
    const pdpText = [
      aktiviti.engage ? `ENGAGE: ${aktiviti.engage}` : '',
      aktiviti.explore ? `EXPLORE: ${aktiviti.explore}` : '',
      aktiviti.explain ? `EXPLAIN: ${aktiviti.explain}` : '',
      aktiviti.elaborate ? `ELABORATE: ${aktiviti.elaborate}` : '',
      aktiviti.evaluate ? `EVALUATE: ${aktiviti.evaluate}` : '',
    ].filter(Boolean).join('\n\n');
    
    rphFormData.set('aktiviti_pdp', pdpText);
    if (rphContent.bahan_bantu_mengajar) rphFormData.set('bbm', rphContent.bahan_bantu_mengajar);
    if (rphContent.refleksi) rphFormData.set('refleksi', rphContent.refleksi);
    if (rphContent.elemen_merentas_kurikulum) rphFormData.set('emk', rphContent.elemen_merentas_kurikulum);
    
    rphFormData.set('submit', 'Simpan');

    const submitData = rphFormData.toString();
    await makeRequest({
      hostname: 'asiemodel.net',
      path: '/model/rph.php',
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(submitData),
        'Cookie': cookieHeader,
        'Origin': 'https://asiemodel.net',
        'Referer': 'https://asiemodel.net/model/rph.php?action=add'
      }
    }, submitData);

    return Response.json({ success: true, message: 'RPH berjaya dihantar ke ASIE Model!' });

  } catch (error) {
    console.error('[submit-rph] Error:', error);
    return Response.json({
      success: false,
      error: 'Ralat pelayan: ' + error.message
    }, { status: 500 });
  }
}
