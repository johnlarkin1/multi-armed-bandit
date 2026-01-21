/**
 * Get current active run info.
 * Proxies to FastAPI if available, otherwise returns null.
 */

import { NextResponse } from 'next/server';
import { isFastAPIAvailable, proxyToFastAPIJson } from '@/lib/fastapi-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const fastAPIAvailable = await isFastAPIAvailable();

  if (fastAPIAvailable) {
    const data = await proxyToFastAPIJson('/api/runs/current');
    if (data) {
      return NextResponse.json(data);
    }
  }

  // No current run when FastAPI is unavailable
  return NextResponse.json({
    run_id: null,
    strategy: null,
    active: false,
  });
}
