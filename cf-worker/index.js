export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }

    try {
      const body = await request.json();
      const { username, password } = body || {};

      if (!username || !password) {
        return new Response(JSON.stringify({ success: false, error: "Username & Password required" }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

      // 1. GET index.php to obtain initial session cookie
      const initRes = await fetch('https://asiemodel.net/model/index.php', {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      const getCookies = (res) => {
        if (res.headers.getSetCookie) {
          return res.headers.getSetCookie().join('; ');
        }
        return res.headers.get('set-cookie') || '';
      };

      const initCookieStr = getCookies(initRes);
      const sessMatch = initCookieStr.match(/PHPSESSID=([^;]+)/i);
      const initialPhpsessid = sessMatch ? sessMatch[1] : '';

      // 2. POST login
      const loginBody = new URLSearchParams({
        username,
        password,
        redirect: 'main.php?cb=ms',
        language: 'en',
        view: 'home',
        submit: 'Login'
      });

      const loginRes = await fetch('https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': initialPhpsessid ? 'PHPSESSID=' + initialPhpsessid : '',
          'User-Agent': userAgent,
          'Origin': 'https://asiemodel.net',
          'Referer': 'https://asiemodel.net/model/index.php'
        },
        body: loginBody.toString(),
        redirect: 'manual'
      });

      const postCookieStr = getCookies(loginRes);
      const postSessMatch = postCookieStr.match(/PHPSESSID=([^;]+)/i);
      const finalPhpsessid = postSessMatch ? postSessMatch[1] : initialPhpsessid;

      if (!finalPhpsessid) {
        return new Response(JSON.stringify({ success: false, error: "No PHPSESSID obtained", debug: { initStatus: initRes.status, loginStatus: loginRes.status } }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      // 3. GET search9.php
      const searchRes = await fetch('https://asiemodel.net/model/search9.php?action=search_yearly', {
        headers: {
          'Cookie': 'PHPSESSID=' + finalPhpsessid,
          'User-Agent': userAgent,
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
        rpts.push({ title, url: rawUrl.startsWith('http') ? rawUrl : 'https://asiemodel.net/model/' + rawUrl });
      }

      return new Response(JSON.stringify({ success: true, data: rpts, debug: { initStatus: initRes.status, loginStatus: loginRes.status, searchStatus: searchRes.status, rptCount: rpts.length } }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
