// POST /api/get-schedule
// Direct ASIE access with browser-like headers

export const maxDuration = 60;

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36';
const BROWSER_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-MY,en;q=0.9,ms;q=0.8',
  'Sec-Ch-Ua': '"Chromium";v="126", "Not/A)Brand";v="8", "Google Chrome";v="126"',
  'Sec-Ch-Ua-Mobile': '?1',
  'Sec-Ch-Ua-Platform': '"Android"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

async function loginASIE(username, password) {
  const initRes = await fetch('https://asiemodel.net/model/index.php', { headers: BROWSER_HEADERS, redirect: 'manual' });
  const initBody = await initRes.text();
  if (initBody.includes('cf_chl_opt')) return { success: false, cfBlocked: true };

  const cookies = initRes.headers.getSetCookie?.() || [];
  const sessMatch = cookies.join('; ').match(/PHPSESSID=([^;]+)/i);
  const initSess = sessMatch ? sessMatch[1] : '';

  const loginRes = await fetch('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', {
    method: 'POST',
    headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': initSess ? 'PHPSESSID=' + initSess : '', 'Origin': 'https://asiemodel.net', 'Referer': 'https://asiemodel.net/model/index.php', 'Sec-Fetch-Site': 'same-origin' },
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
    const { credentials, username: bu, password: bp } = body || {};
    const username = credentials?.username || bu;
    const password = credentials?.password || bp;
    if (!username || !password) return Response.json({ success: false, error: 'Kredensial diperlukan.' }, { status: 400 });

    const login = await loginASIE(username, password);
    if (login.cfBlocked) return Response.json({ success: false, error: 'Cloudflare menyekat akses. Sila gunakan aplikasi desktop/Android.', cfBlocked: true });
    if (!login.success) return Response.json({ success: false, error: 'Login ASIE gagal. Semak kredensial.' });

    const jRes = await fetch('https://asiemodel.net/model/teachers9.php?action=waktumengajar', {
      headers: { ...BROWSER_HEADERS, 'Cookie': 'PHPSESSID=' + login.phpsessid, 'Referer': 'https://asiemodel.net/model/main.php', 'Sec-Fetch-Site': 'same-origin' }
    });
    const html = await jRes.text();
    if (html.includes('cf_chl_opt')) return Response.json({ success: false, error: 'Cloudflare menyekat. Sila gunakan aplikasi desktop/Android.', cfBlocked: true });

    const subjectMap = { 'mathematics': 'Matematik', 'physics': 'Fizik', 'chemistry': 'Kimia', 'biology': 'Biologi', 'science': 'Sains', 'arabic': 'Bahasa Arab', 'english': 'Bahasa Inggeris', 'malay': 'Bahasa Melayu', 'history': 'Sejarah', 'geography': 'Geografi', 'islamic_studies': 'Pendidikan Islam', 'moral': 'Pendidikan Moral' };
    const blocks = html.split(/li_row li_sortable/).slice(1);
    const results = [];
    blocks.forEach(block => {
      try {
        const dayM = block.match(/name="days\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/i);
        const classM = block.match(/name="class_id\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/i);
        const subjM = block.match(/name="subject\[\d+\]"[^>]*value="([^"]+)"/i);
        const startM = block.match(/name="starttime\[\d+\]"[^>]*value="([^"]+)"/i);
        const endM = block.match(/name="endtime\[\d+\]"[^>]*value="([^"]+)"/i);
        const day = dayM?.[1]?.trim(), cls = classM?.[1]?.trim();
        const rawSubj = subjM?.[1]?.trim(), subj = subjectMap[rawSubj] || rawSubj;
        const st = startM?.[1]?.trim(), en = endM?.[1]?.trim();
        if (day && cls && subj && st && en) {
          results.push({ id: `jadual-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, day, class: cls, className: cls, subject: subj, time: `${st} - ${en}`, subjectId: 'custom-subject', active: true, imported: true });
        }
      } catch {}
    });

    return Response.json({ success: true, schedule: results });
  } catch (error) {
    console.error('[get-schedule] Error:', error);
    return Response.json({ success: false, error: 'Ralat: ' + error.message }, { status: 500 });
  }
}
