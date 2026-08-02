// POST /api/submit-rph
// Proxies through Cloudflare Worker

const CF_WORKER_URL = process.env.CF_WORKER_URL || 'https://cids-proxy.abdulhalimroslan2.workers.dev';

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, lessonDetails, rphContent, miwDate } = body;

    if (!credentials?.username || !credentials?.password) {
      return Response.json({ success: false, error: 'Kredensial tidak sah.' }, { status: 400 });
    }

    const res = await fetch(`${CF_WORKER_URL}/submit-rph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials, lessonDetails, rphContent, miwDate }),
    });

    const data = await res.json();
    return Response.json(data);

  } catch (error) {
    console.error('[submit-rph] Error:', error);
    return Response.json({ success: false, error: 'Ralat pelayan: ' + error.message }, { status: 500 });
  }
}
