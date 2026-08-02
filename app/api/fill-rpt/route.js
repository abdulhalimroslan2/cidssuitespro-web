// POST /api/fill-rpt — Direct ASIE access

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
    const { credentials, rptUrl, formData } = body;
    if (!credentials?.username || !credentials?.password) return Response.json({ success: false, error: 'Kredensial tidak sah.' }, { status: 400 });
    if (!formData) return Response.json({ success: false, error: 'Tiada data RPT.' }, { status: 400 });

    const login = await loginASIE(credentials.username, credentials.password);
    if (login.cfBlocked) return Response.json({ success: false, error: 'Cloudflare menyekat akses. Sila gunakan aplikasi desktop/Android.', cfBlocked: true });
    if (!login.success) return Response.json({ success: false, error: 'Login ASIE gagal.' });

    const cookieHeader = 'PHPSESSID=' + login.phpsessid;
    let rptPath = '/model/search9.php?action=search_yearly';
    if (rptUrl) { try { const u = new URL(rptUrl); rptPath = u.pathname + u.search; } catch { rptPath = rptUrl.replace('https://asiemodel.net', ''); } }

    await fetch('https://asiemodel.net' + rptPath, { headers: { ...BH, 'Cookie': cookieHeader, 'Sec-Fetch-Site': 'same-origin' } });

    const rptFormData = new URLSearchParams();
    if (formData.namaRekodForm) rptFormData.set('name', formData.namaRekodForm);
    if (formData.tarikhDari) rptFormData.set('date_from', formData.tarikhDari);
    if (formData.tarikhHingga) rptFormData.set('date_to', formData.tarikhHingga);
    if (formData.mingguKalendar) rptFormData.set('calendar_week', formData.mingguKalendar);
    if (formData.bidangPembelajaran) rptFormData.set('topic_area', formData.bidangPembelajaran);
    if (formData.tajukPembelajaran) rptFormData.set('topic', formData.tajukPembelajaran);
    if (formData.standardKandungan) rptFormData.set('standard_kandungan', formData.standardKandungan);
    if (formData.standardPembelajaran) rptFormData.set('standard_pembelajaran', formData.standardPembelajaran);
    if (formData.objektifPembelajaran) rptFormData.set('objective', formData.objektifPembelajaran);
    rptFormData.set('submit', 'Simpan');

    const submitRes = await fetch('https://asiemodel.net' + rptPath, {
      method: 'POST', headers: { ...BH, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieHeader, 'Origin': 'https://asiemodel.net', 'Referer': 'https://asiemodel.net' + rptPath, 'Sec-Fetch-Site': 'same-origin' },
      body: rptFormData.toString(), redirect: 'manual',
    });

    return Response.json({ success: true, message: submitRes.status === 302 ? 'RPT berjaya diisi!' : 'RPT dihantar (status: ' + submitRes.status + ')' });
  } catch (error) {
    console.error('[fill-rpt] Error:', error);
    return Response.json({ success: false, error: 'Ralat: ' + error.message }, { status: 500 });
  }
}
