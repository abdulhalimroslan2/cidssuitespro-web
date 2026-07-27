import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { credentials, username: bodyUser, password: bodyPass } = await req.json();
    const username = credentials?.username || bodyUser;
    const password = credentials?.password || bodyPass;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username dan Password ASIE diperlukan.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[Edge Function] Logging in to ASIE for ${username}...`);

    const loginBody = new URLSearchParams({
      username: username,
      password: password,
      redirect: 'main.php?cb=ms',
      language: 'en',
      view: 'home',
      submit: 'Login'
    });

    const loginRes = await fetch('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin': 'https://asiemodel.net',
        'Referer': 'https://asiemodel.net/model/index.php'
      },
      body: loginBody.toString(),
      redirect: 'manual'
    });

    const setCookieStr = loginRes.headers.get('set-cookie') || '';
    console.log(`[Edge Function] set-cookie: ${setCookieStr.substring(0, 80)}`);

    const sessMatch = setCookieStr.match(/PHPSESSID=([^;]+)/i);
    const phpsessid = sessMatch ? sessMatch[1] : '';

    if (!phpsessid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Gagal log masuk ke asiemodel.net.',
          debug: { status: loginRes.status, cookie: setCookieStr }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[Edge Function] Got session ${phpsessid.substring(0, 8)}... Fetching search9.php`);

    const searchRes = await fetch('https://asiemodel.net/model/search9.php?action=search_yearly', {
      headers: {
        'Cookie': 'PHPSESSID=' + phpsessid,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://asiemodel.net/model/main.php'
      }
    });

    const html = await searchRes.text();
    const linkRegex = /<a[^>]+href=['"]([^'"]*create_rpt[^'"]*)['"'][^>]*>([^<]+)<\/a>/gi;
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
      if (title && title.length > 2) {
        rpts.push({ title, url: fullUrl });
      }
    }

    console.log(`[Edge Function] Extracted ${rpts.length} RPT items`);

    return new Response(
      JSON.stringify({ success: true, data: rpts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
