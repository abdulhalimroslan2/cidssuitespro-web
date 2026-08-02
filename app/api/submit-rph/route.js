// POST /api/submit-rph — Full RPH submission via Render Playwright proxy
// Receives NDJSON stream from proxy and converts to SSE for client

const PROXY_URL = process.env.ASIE_PROXY_URL || 'https://cids-asie-proxy.onrender.com';

export const maxDuration = 300; // 5 min for full RPH process

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, lessonDetails, rphContent, miwDate } = body;

    if (!credentials?.username || !credentials?.password) {
      return Response.json({ success: false, error: 'Kredensial tidak sah.' }, { status: 400 });
    }

    // For single lesson submission, we wrap it as an array for the proxy
    const lessons = Array.isArray(lessonDetails) ? lessonDetails : [lessonDetails];
    
    // Get API key from the request body
    const apiKey = body.apiKey || '';
    const bbm = body.bbm || [];

    const proxyRes = await fetch(`${PROXY_URL}/submit-rph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials, lessons, miwDate, apiKey, bbm }),
    });

    // Forward the NDJSON stream as-is
    if (proxyRes.body) {
      return new Response(proxyRes.body, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
        }
      });
    }

    const data = await proxyRes.json();
    return Response.json(data);

  } catch (error) {
    console.error('[submit-rph] Error:', error);
    return Response.json({ success: false, error: 'Ralat: ' + error.message }, { status: 500 });
  }
}
