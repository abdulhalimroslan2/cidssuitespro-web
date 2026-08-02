// POST /api/fill-rpt — Via Render Playwright proxy

const PROXY_URL = process.env.ASIE_PROXY_URL || 'https://cids-asie-proxy.onrender.com';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, rptUrl, formData } = body;
    if (!credentials?.username || !credentials?.password) return Response.json({ success: false, error: 'Kredensial tidak sah.' }, { status: 400 });
    if (!formData) return Response.json({ success: false, error: 'Tiada data RPT.' }, { status: 400 });

    const res = await fetch(`${PROXY_URL}/fill-rpt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials, rptUrl, formData }),
      signal: AbortSignal.timeout(55000),
    });

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    console.error('[fill-rpt] Error:', error);
    return Response.json({ success: false, error: 'Ralat: ' + error.message }, { status: 500 });
  }
}
