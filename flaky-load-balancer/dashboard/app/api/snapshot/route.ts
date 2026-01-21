/**
 * Current metrics snapshot endpoint.
 * Proxies to FastAPI if available, otherwise reads metrics.json.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { isFastAPIAvailable, proxyToFastAPIJson } from '@/lib/fastapi-client';
import { METRICS_JSON_PATH } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const fastAPIAvailable = await isFastAPIAvailable();

  if (fastAPIAvailable) {
    const data = await proxyToFastAPIJson('/api/snapshot');
    if (data) {
      return NextResponse.json(data);
    }
  }

  // Fallback: read metrics.json
  try {
    const metricsPath = path.resolve(process.cwd(), METRICS_JSON_PATH);
    const content = await fs.readFile(metricsPath, 'utf-8');
    const metrics = JSON.parse(content);
    return NextResponse.json({
      ...metrics,
      timestamp: Date.now() / 1000,
      run_id: null,
      strategy: null,
    });
  } catch {
    return NextResponse.json(
      { error: 'No metrics available', timestamp: Date.now() / 1000 },
      { status: 503 }
    );
  }
}
