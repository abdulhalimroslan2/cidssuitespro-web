// POST /api/delete-rph — Via Render Playwright proxy

const PROXY_URL = process.env.ASIE_PROXY_URL || 'https://cids-asie-proxy.onrender.com';

export const maxDuration = 120;

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, month, year } = body;
    if (!credentials?.username || !credentials?.password) return Response.json({ success: false, error: 'Kredensial tidak sah.' }, { status: 400 });

    const proxyRes = await fetch(`${PROXY_URL}/delete-rph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials, month, year }),
      signal: AbortSignal.timeout(110000),
    });

    const data = await proxyRes.json();

    // Convert to SSE for client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        if (data.success) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message: `🔍 Menemui ${data.total} RPH untuk dipadam...` })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', total: data.total, deleted: data.deleted, failed: data.failed })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', total: data.total, deleted: data.deleted, failed: data.failed })}\n\n`));
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: data.error || 'Gagal memadam RPH' })}\n\n`));
        }
        controller.close();
      }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
  } catch (error) {
    console.error('[delete-rph] Error:', error);
    return Response.json({ success: false, error: 'Ralat: ' + error.message }, { status: 500 });
  }
}
