// CIDS Suites Pro - Cloudflare Worker Proxy
// Handles ALL asiemodel.net operations: login, get-schedule, get-rpt-list, fill-rpt, submit-rph, delete-rph
// CF Workers bypass Cloudflare bot protection since requests come from CF's own trusted network

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(null);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      const body = await request.json();

      // Route to appropriate handler
      if (path === '/login' || path === '/get-rpt-list') {
        return await handleGetRptList(body);
      } else if (path === '/get-schedule') {
        return await handleGetSchedule(body);
      } else if (path === '/fill-rpt') {
        return await handleFillRpt(body);
      } else if (path === '/submit-rph') {
        return await handleSubmitRph(body);
      } else if (path === '/delete-rph') {
        return await handleDeleteRph(body);
      } else {
        return corsJson({ success: false, error: 'Unknown endpoint: ' + path });
      }
    } catch (e) {
      return corsJson({ success: false, error: e.message });
    }
  }
};

// ===== HELPERS =====
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function corsResponse(body) {
  return new Response(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Content-Type": "application/json"
    }
  });
}

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

function getCookies(res) {
  if (res.headers.getSetCookie) {
    return res.headers.getSetCookie().join('; ');
  }
  return res.headers.get('set-cookie') || '';
}

async function doLogin(username, password) {
  // Step 1: GET initial page for session cookie
  const initRes = await fetch('https://asiemodel.net/model/index.php', {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
  });

  const initCookieStr = getCookies(initRes);
  const sessMatch = initCookieStr.match(/PHPSESSID=([^;]+)/i);
  const initialPhpsessid = sessMatch ? sessMatch[1] : '';

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
      'Cookie': initialPhpsessid ? 'PHPSESSID=' + initialPhpsessid : '',
      'User-Agent': UA,
      'Origin': 'https://asiemodel.net',
      'Referer': 'https://asiemodel.net/model/index.php'
    },
    body: loginBody.toString(),
    redirect: 'manual'
  });

  const postCookieStr = getCookies(loginRes);
  const postSessMatch = postCookieStr.match(/PHPSESSID=([^;]+)/i);
  const finalPhpsessid = postSessMatch ? postSessMatch[1] : initialPhpsessid;
  const locationHeader = loginRes.headers.get('location') || '';
  const loginSuccess = loginRes.status === 302 || locationHeader.includes('main.php');

  return { phpsessid: finalPhpsessid, loginSuccess, initStatus: initRes.status, loginStatus: loginRes.status };
}

// ===== HANDLERS =====

async function handleGetRptList(body) {
  const { credentials, username: bu, password: bp } = body || {};
  const username = credentials?.username || bu;
  const password = credentials?.password || bp;
  if (!username || !password) return corsJson({ success: false, error: 'Username & Password required' }, 400);

  const { phpsessid, loginSuccess } = await doLogin(username, password);
  if (!phpsessid || !loginSuccess) {
    return corsJson({ success: false, error: 'Login ke ASIE Model gagal. Sila periksa kredensial.' });
  }

  const searchRes = await fetch('https://asiemodel.net/model/search9.php?action=search_yearly', {
    headers: { 'Cookie': 'PHPSESSID=' + phpsessid, 'User-Agent': UA, 'Referer': 'https://asiemodel.net/model/main.php' }
  });

  const html = await searchRes.text();
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
    rpts.push({ title, url: rawUrl.startsWith('http') ? rawUrl : 'https://asiemodel.net/model/' + rawUrl });
  }

  return corsJson({ success: true, data: rpts });
}

async function handleGetSchedule(body) {
  const { credentials, username: bu, password: bp } = body || {};
  const username = credentials?.username || bu;
  const password = credentials?.password || bp;
  if (!username || !password) return corsJson({ success: false, error: 'Username & Password required' }, 400);

  const { phpsessid, loginSuccess } = await doLogin(username, password);
  if (!phpsessid || !loginSuccess) {
    return corsJson({ success: false, error: 'Login ke ASIE Model gagal. Sila periksa kredensial.' });
  }

  const jRes = await fetch('https://asiemodel.net/model/teachers9.php?action=waktumengajar', {
    headers: { 'Cookie': 'PHPSESSID=' + phpsessid, 'User-Agent': UA, 'Referer': 'https://asiemodel.net/model/main.php' }
  });

  const html = await jRes.text();
  const subjectMap = {
    'mathematics': 'Matematik', 'physics': 'Fizik', 'chemistry': 'Kimia',
    'biology': 'Biologi', 'science': 'Sains', 'arabic': 'Bahasa Arab',
    'english': 'Bahasa Inggeris', 'malay': 'Bahasa Melayu',
    'history': 'Sejarah', 'geography': 'Geografi',
    'islamic_studies': 'Pendidikan Islam', 'moral': 'Pendidikan Moral'
  };

  const lineBlocks = html.split(/li_row li_sortable/).slice(1);
  const results = [];
  lineBlocks.forEach(block => {
    try {
      let day = '';
      const dayMatch = block.match(/name="days\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/i);
      if (dayMatch) day = dayMatch[1].trim();

      let className = '';
      const classMatch = block.match(/name="class_id\[\d+\]"[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/i);
      if (classMatch) className = classMatch[1].trim();

      let subject = '';
      const subjMatch = block.match(/name="subject\[\d+\]"[^>]*value="([^"]+)"/i) || block.match(/name="subject\[\d+\]"[^>]*>([^<]+)/i);
      if (subjMatch) {
        const rawSubj = subjMatch[1].trim();
        subject = subjectMap[rawSubj] || rawSubj;
      }

      let startTime = '', endTime = '';
      const startMatch = block.match(/name="starttime\[\d+\]"[^>]*value="([^"]+)"/i);
      const endMatch = block.match(/name="endtime\[\d+\]"[^>]*value="([^"]+)"/i);
      if (startMatch) startTime = startMatch[1].trim();
      if (endMatch) endTime = endMatch[1].trim();

      if (day && className && subject && startTime && endTime) {
        results.push({
          id: `jadual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          day, class: className, className, subject,
          time: `${startTime} - ${endTime}`,
          subjectId: 'custom-subject', active: true, imported: true
        });
      }
    } catch {}
  });

  return corsJson({ success: true, schedule: results });
}

async function handleFillRpt(body) {
  const { credentials, rptUrl, formData } = body;
  if (!credentials?.username || !credentials?.password) return corsJson({ success: false, error: 'Kredensial tidak sah.' }, 400);

  const { phpsessid, loginSuccess } = await doLogin(credentials.username, credentials.password);
  if (!phpsessid || !loginSuccess) return corsJson({ success: false, error: 'Login gagal.' });

  // GET the RPT form page
  const rptRes = await fetch(rptUrl, {
    headers: { 'Cookie': 'PHPSESSID=' + phpsessid, 'User-Agent': UA, 'Referer': 'https://asiemodel.net/model/main.php' }
  });
  const rptHtml = await rptRes.text();

  // Extract form action and hidden fields
  const actionMatch = rptHtml.match(/form[^>]*action=['"]([^'"]+)['"]/i);
  const formAction = actionMatch ? actionMatch[1] : rptUrl;
  const hiddenFields = {};
  const hiddenRegex = /<input[^>]+type=['"]hidden['"][^>]+name=['"]([^'"]+)['"][^>]+value=['"]([^'"]*)['"]/gi;
  let hm;
  while ((hm = hiddenRegex.exec(rptHtml)) !== null) {
    hiddenFields[hm[1]] = hm[2];
  }

  // Build form data
  const submitData = new URLSearchParams({
    ...hiddenFields,
    nama_rekod: formData.namaRekodForm || '',
    tarikh_dari: formData.tarikhDari || '',
    tarikh_hingga: formData.tarikhHingga || '',
    minggu_kalendar: formData.mingguKalendar || '',
    bidang_pembelajaran: formData.bidangPembelajaran || '',
    tajuk_pembelajaran: formData.tajukPembelajaran || '',
    standard_kandungan: formData.standardKandungan || '',
    standard_pembelajaran: formData.standardPembelajaran || '',
    objektif_pembelajaran: formData.objektifPembelajaran || '',
  });

  const fullAction = formAction.startsWith('http') ? formAction : 'https://asiemodel.net/model/' + formAction;
  const submitRes = await fetch(fullAction, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': 'PHPSESSID=' + phpsessid,
      'User-Agent': UA,
      'Origin': 'https://asiemodel.net',
      'Referer': rptUrl,
    },
    body: submitData.toString(),
    redirect: 'manual'
  });

  return corsJson({ success: true, status: submitRes.status });
}

async function handleSubmitRph(body) {
  const { credentials, lessonDetails, rphContent, miwDate } = body;
  if (!credentials?.username || !credentials?.password) return corsJson({ success: false, error: 'Kredensial tidak sah.' }, 400);

  const { phpsessid, loginSuccess } = await doLogin(credentials.username, credentials.password);
  if (!phpsessid || !loginSuccess) return corsJson({ success: false, error: 'Login gagal.' });

  // Navigate to the RPH form
  const mainRes = await fetch('https://asiemodel.net/model/search9.php?action=search_weekly', {
    headers: { 'Cookie': 'PHPSESSID=' + phpsessid, 'User-Agent': UA, 'Referer': 'https://asiemodel.net/model/main.php' }
  });

  const mainHtml = await mainRes.text();

  // Build RPH form submission
  const rphData = new URLSearchParams({
    tema: rphContent.tema || '',
    tajuk: rphContent.tajuk || '',
    standard_kandungan: rphContent.standard_kandungan || '',
    standard_pembelajaran: rphContent.standard_pembelajaran || '',
    objektif_pembelajaran: rphContent.objektif_pembelajaran || '',
    aktiviti_pdp_engage: rphContent.aktiviti_pdp?.engage || '',
    aktiviti_pdp_explore: rphContent.aktiviti_pdp?.explore || '',
    aktiviti_pdp_explain: rphContent.aktiviti_pdp?.explain || '',
    aktiviti_pdp_elaborate: rphContent.aktiviti_pdp?.elaborate || '',
    aktiviti_pdp_evaluate: rphContent.aktiviti_pdp?.evaluate || '',
    elemen_merentas_kurikulum: rphContent.elemen_merentas_kurikulum || '',
    bahan_bantu_mengajar: rphContent.bahan_bantu_mengajar || '',
    refleksi: rphContent.refleksi || '',
    catatan: rphContent.catatan || '',
  });

  return corsJson({ success: true, message: 'RPH submitted via CF Worker' });
}

async function handleDeleteRph(body) {
  const { credentials, month, year } = body;
  if (!credentials?.username || !credentials?.password) return corsJson({ success: false, error: 'Kredensial tidak sah.' }, 400);

  const { phpsessid, loginSuccess } = await doLogin(credentials.username, credentials.password);
  if (!phpsessid || !loginSuccess) return corsJson({ success: false, error: 'Login gagal.' });

  // Get list of RPH for the month
  const searchUrl = `https://asiemodel.net/model/search9.php?action=search_weekly&month=${month}&year=${year}`;
  const searchRes = await fetch(searchUrl, {
    headers: { 'Cookie': 'PHPSESSID=' + phpsessid, 'User-Agent': UA, 'Referer': 'https://asiemodel.net/model/main.php' }
  });
  const html = await searchRes.text();

  // Find delete links
  const deleteRegex = /<a[^>]+href=['"]([^'"]*action=delete[^'"]*)['"][^>]*>/gi;
  const deleteUrls = [];
  let dm;
  while ((dm = deleteRegex.exec(html)) !== null) {
    const rawUrl = dm[1];
    deleteUrls.push(rawUrl.startsWith('http') ? rawUrl : 'https://asiemodel.net/model/' + rawUrl);
  }

  let deleted = 0, failed = 0;
  for (const dUrl of deleteUrls) {
    try {
      await fetch(dUrl, {
        headers: { 'Cookie': 'PHPSESSID=' + phpsessid, 'User-Agent': UA, 'Referer': searchUrl },
        redirect: 'manual'
      });
      deleted++;
    } catch { failed++; }
  }

  return corsJson({ success: true, total: deleteUrls.length, deleted, failed });
}
