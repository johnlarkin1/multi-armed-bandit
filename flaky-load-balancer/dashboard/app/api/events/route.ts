/**
 * SSE endpoint for real-time metrics streaming.
 * Proxies to FastAPI if available, otherwise returns unavailable event.
 */

import { isFastAPIAvailable, proxyToFastAPI } from '@/lib/fastapi-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const fastAPIAvailable = await isFastAPIAvailable();

  if (fastAPIAvailable) {
    // Proxy SSE stream from FastAPI
    try {
      const response = await proxyToFastAPI('/api/events');

      if (response.body) {
        return new Response(response.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        });
      }
    } catch {
      // Fall through to unavailable response
    }
  }

  // Return unavailable status
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const data = {
        type: 'unavailable',
        message: 'FastAPI not available. Historical data only.',
        timestamp: Date.now() / 1000,
      };
      controller.enqueue(encoder.encode(`event: unavailable\ndata: ${JSON.stringify(data)}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
