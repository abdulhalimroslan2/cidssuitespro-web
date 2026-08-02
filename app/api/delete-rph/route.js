// POST /api/delete-rph
// Proxies through Cloudflare Worker — uses SSE for progress

const CF_WORKER_URL = process.env.CF_WORKER_URL || 'https://cids-proxy.holistic-measure.workers.dev';

export async function POST(request) {
  try {
    const body = await request.json();
    const { credentials, month, year } = body;

    if (!credentials?.username || !credentials?.password) {
      return Response.json({ success: false, error: 'Kredensial tidak sah.' }, { status: 400 });
    }

    // Call CF Worker for delete operation
    const res = await fetch(`${CF_WORKER_URL}/delete-rph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials, month, year }),
    });

    const data = await res.json();

    // Convert result to SSE stream for client progress
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

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    console.error('[delete-rph] Error:', error);
    return Response.json({ success: false, error: 'Ralat pelayan: ' + error.message }, { status: 500 });
  }
}
