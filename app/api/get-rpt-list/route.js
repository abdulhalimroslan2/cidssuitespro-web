// POST /api/get-rpt-list
// Proxies through Cloudflare Worker to bypass Cloudflare bot protection

const CF_WORKER_URL = process.env.CF_WORKER_URL || 'https://cids-proxy.holistic-measure.workers.dev';

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, username: bodyUser, password: bodyPass } = body || {};
    const username = credentials?.username || bodyUser;
    const password = credentials?.password || bodyPass;

    if (!username || !password) {
      return Response.json({ success: false, error: 'Sila sediakan Nama Pengguna dan Kata Laluan ASIE Model.' }, { status: 400 });
    }

    const res = await fetch(`${CF_WORKER_URL}/get-rpt-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: { username, password } }),
    });

    const data = await res.json();
    return Response.json(data);

  } catch (error) {
    console.error('[get-rpt-list] Error:', error);
    return Response.json({ success: false, error: 'Ralat pelayan: ' + error.message }, { status: 500 });
  }
}
