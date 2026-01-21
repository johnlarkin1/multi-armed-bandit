/**
 * List all available runs.
 * Always reads from CSV files, optionally gets current_run_id from FastAPI.
 */

import { NextResponse } from 'next/server';
import { isFastAPIAvailable, proxyToFastAPIJson } from '@/lib/fastapi-client';
import { listRuns } from '@/lib/csv-reader';

export const dynamic = 'force-dynamic';

interface CurrentRunResponse {
  run_id: string | null;
  strategy: string | null;
  active: boolean;
}

export async function GET() {
  // Read runs from CSV files
  const runs = await listRuns();

  // Try to get current run info from FastAPI
  let currentRunId: string | null = null;

  const fastAPIAvailable = await isFastAPIAvailable();
  if (fastAPIAvailable) {
    const currentRun = await proxyToFastAPIJson<CurrentRunResponse>('/api/runs/current');
    if (currentRun?.run_id) {
      currentRunId = currentRun.run_id;

      // Mark the current run in our list
      for (const run of runs) {
        run.is_current = run.run_id === currentRunId;
      }
    }
  }

  return NextResponse.json({
    runs,
    current_run_id: currentRunId,
  });
}
