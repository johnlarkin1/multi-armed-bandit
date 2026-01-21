/**
 * Get time-windowed metrics snapshots for a run.
 * Proxies to FastAPI for current run, otherwise reads from CSV files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isFastAPIAvailable, proxyToFastAPIJson } from '@/lib/fastapi-client';
import { readRun, getMostRecentRun, type AttemptRecord } from '@/lib/csv-reader';
import { buildSnapshotsFromRecords } from '@/lib/snapshot-builder';

export const dynamic = 'force-dynamic';

interface SnapshotsResponse {
  snapshots: unknown[];
  strategy: string | null;
  run_id: string | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const runId = searchParams.get('run_id');

  const fastAPIAvailable = await isFastAPIAvailable();

  // If FastAPI is available and we're not requesting a specific run, proxy to FastAPI
  if (fastAPIAvailable && !runId) {
    const path = '/api/history/snapshots';
    const data = await proxyToFastAPIJson<SnapshotsResponse>(path);
    if (data) {
      return NextResponse.json(data);
    }
  }

  // Read from CSV files
  let records: AttemptRecord[];
  let resolvedRunId: string | null = runId;

  if (runId) {
    records = await readRun(runId);
  } else {
    const recentRun = await getMostRecentRun();
    if (recentRun) {
      records = recentRun.records;
      resolvedRunId = recentRun.runId;
    } else {
      records = [];
    }
  }

  if (records.length === 0) {
    return NextResponse.json({
      snapshots: [],
      strategy: null,
      run_id: resolvedRunId,
    });
  }

  const strategy = records[0].strategy;
  const snapshots = buildSnapshotsFromRecords(records, resolvedRunId);

  return NextResponse.json({
    snapshots,
    strategy,
    run_id: resolvedRunId,
  });
}
