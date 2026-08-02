// POST /api/fill-rpt
// Proxies through Cloudflare Worker

const CF_WORKER_URL = process.env.CF_WORKER_URL || 'https://cids-proxy.abdulhalimroslan2.workers.dev';

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, rptUrl, formData } = body;

    if (!credentials?.username || !credentials?.password) {
      return Response.json({ success: false, error: 'Kredensial tidak sah.' }, { status: 400 });
    }
    if (!formData) {
      return Response.json({ success: false, error: 'Tiada data form RPT.' }, { status: 400 });
    }

    const res = await fetch(`${CF_WORKER_URL}/fill-rpt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials, rptUrl, formData }),
    });

    const data = await res.json();
    return Response.json(data);

  } catch (error) {
    console.error('[fill-rpt] Error:', error);
    return Response.json({ success: false, error: 'Ralat pelayan: ' + error.message }, { status: 500 });
  }
}
