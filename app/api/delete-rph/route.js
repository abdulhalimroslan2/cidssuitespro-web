// POST /api/delete-rph — Direct ASIE access with SSE progress

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
    const { credentials, month, year } = body;
    if (!credentials?.username || !credentials?.password) return Response.json({ success: false, error: 'Kredensial tidak sah.' }, { status: 400 });

    const login = await loginASIE(credentials.username, credentials.password);
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(data) { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); }

        if (login.cfBlocked) {
          send({ type: 'error', message: 'Cloudflare menyekat akses. Sila gunakan aplikasi desktop/Android.' });
          controller.close(); return;
        }
        if (!login.success) {
          send({ type: 'error', message: 'Login ASIE gagal. Semak kredensial.' });
          controller.close(); return;
        }

        send({ type: 'log', message: '✅ Login ASIE berjaya!' });

        // Fetch RPH list for the month
        const searchUrl = `https://asiemodel.net/model/search9.php?action=search_weekly&month=${month}&year=${year}`;
        const searchRes = await fetch(searchUrl, {
          headers: { ...BH, 'Cookie': 'PHPSESSID=' + login.phpsessid, 'Referer': 'https://asiemodel.net/model/main.php', 'Sec-Fetch-Site': 'same-origin' }
        });
        const html = await searchRes.text();

        if (html.includes('cf_chl_opt')) {
          send({ type: 'error', message: 'Cloudflare menyekat halaman RPH. Sila gunakan aplikasi desktop/Android.' });
          controller.close(); return;
        }

        // Find delete links
        const deleteRegex = /<a[^>]+href=['"]([^'"]*action=delete[^'"]*)['"][^>]*>/gi;
        const deleteUrls = [];
        let dm;
        while ((dm = deleteRegex.exec(html)) !== null) {
          const rawUrl = dm[1];
          deleteUrls.push(rawUrl.startsWith('http') ? rawUrl : 'https://asiemodel.net/model/' + rawUrl);
        }

        send({ type: 'log', message: `🔍 Menemui ${deleteUrls.length} RPH untuk dipadam...` });
        send({ type: 'progress', total: deleteUrls.length, deleted: 0, failed: 0 });

        let deleted = 0, failed = 0;
        for (let i = 0; i < deleteUrls.length; i++) {
          try {
            await fetch(deleteUrls[i], {
              headers: { ...BH, 'Cookie': 'PHPSESSID=' + login.phpsessid, 'Referer': searchUrl, 'Sec-Fetch-Site': 'same-origin' },
              redirect: 'manual'
            });
            deleted++;
            send({ type: 'log', message: `🗑️ [${i + 1}/${deleteUrls.length}] RPH dipadam.`, level: 'success' });
          } catch {
            failed++;
            send({ type: 'log', message: `❌ [${i + 1}/${deleteUrls.length}] Gagal memadam.`, level: 'error' });
          }
          send({ type: 'progress', total: deleteUrls.length, deleted, failed });
        }

        send({ type: 'complete', total: deleteUrls.length, deleted, failed });
        controller.close();
      }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
  } catch (error) {
    console.error('[delete-rph] Error:', error);
    return Response.json({ success: false, error: 'Ralat: ' + error.message }, { status: 500 });
  }
}
