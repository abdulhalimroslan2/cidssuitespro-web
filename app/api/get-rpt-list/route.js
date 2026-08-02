// POST /api/get-rpt-list
// Proxies through Render.com Playwright proxy (headless browser)

const PROXY_URL = process.env.ASIE_PROXY_URL || 'https://cids-asie-proxy.onrender.com';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, username: bu, password: bp } = body || {};
    const username = credentials?.username || bu;
    const password = credentials?.password || bp;

    if (!username || !password) {
      return Response.json({ success: false, error: 'Sila sediakan Nama Pengguna dan Kata Laluan ASIE Model.' }, { status: 400 });
    }

    const res = await fetch(`${PROXY_URL}/get-rpt-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: { username, password } }),
      signal: AbortSignal.timeout(55000),
    });

    const data = await res.json();
    return Response.json(data);

  } catch (error) {
    console.error('[get-rpt-list] Error:', error);
    const isTimeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    return Response.json({
      success: false,
      error: isTimeout
        ? 'Pelayan proxy sedang dimulakan (cold start). Sila cuba lagi dalam 30 saat.'
        : 'Ralat pelayan: ' + error.message
    }, { status: isTimeout ? 503 : 500 });
  }
}
