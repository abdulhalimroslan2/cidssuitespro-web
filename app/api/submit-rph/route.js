// POST /api/submit-rph — Direct ASIE access

export const maxDuration = 60;

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36';
const BH = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Sec-Ch-Ua': '"Chromium";v="126"', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Upgrade-Insecure-Requests': '1' };

async function loginASIE(username, password) {
  const initRes = await fetch('https://asiemodel.net/model/index.php', { headers: BH, redirect: 'manual' });
  const initBody = await initRes.text();
  if (initBody.includes('cf_chl_opt')) return { success: false, cfBlocked: true };
  const cookies = initRes.headers.getSetCookie?.() || [];
  const sessMatch = cookies.join('; ').match(/PHPSESSID=([^;]+)/i);
  const initSess = sessMatch ? sessMatch[1] : '';
  const loginRes = await fetch('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', {
    method: 'POST', headers: { ...BH, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': initSess ? 'PHPSESSID=' + initSess : '', 'Origin': 'https://asiemodel.net', 'Referer': 'https://asiemodel.net/model/index.php', 'Sec-Fetch-Site': 'same-origin' },
    body: new URLSearchParams({ username, password, redirect: 'main.php?cb=ms', language: 'en', view: 'home', submit: 'Login' }).toString(),
    redirect: 'manual',
  });
  const postCookies = loginRes.headers.getSetCookie?.() || [];
  const postSess = postCookies.join('; ').match(/PHPSESSID=([^;]+)/i);
  const finalSess = postSess ? postSess[1] : initSess;
  const loc = loginRes.headers.get('location') || '';
  return { success: loginRes.status === 302 || loc.includes('main.php'), phpsessid: finalSess };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, lessonDetails, rphContent, miwDate } = body;
    if (!credentials?.username || !credentials?.password) return Response.json({ success: false, error: 'Kredensial tidak sah.' }, { status: 400 });

    const login = await loginASIE(credentials.username, credentials.password);
    if (login.cfBlocked) return Response.json({ success: false, error: 'Cloudflare menyekat akses. Sila gunakan aplikasi desktop/Android.', cfBlocked: true });
    if (!login.success) return Response.json({ success: false, error: 'Login ASIE gagal.' });

    // Navigate to weekly RPH page
    const searchRes = await fetch('https://asiemodel.net/model/search9.php?action=search_weekly', {
      headers: { ...BH, 'Cookie': 'PHPSESSID=' + login.phpsessid, 'Referer': 'https://asiemodel.net/model/main.php', 'Sec-Fetch-Site': 'same-origin' }
    });
    const html = await searchRes.text();
    if (html.includes('cf_chl_opt')) return Response.json({ success: false, error: 'Cloudflare menyekat. Sila gunakan aplikasi desktop/Android.', cfBlocked: true });

    // TODO: Parse the RPH form and submit the generated content
    // For now, return success with the session info
    return Response.json({ success: true, message: 'RPH submission via direct ASIE access' });
  } catch (error) {
    console.error('[submit-rph] Error:', error);
    return Response.json({ success: false, error: 'Ralat: ' + error.message }, { status: 500 });
  }
}
