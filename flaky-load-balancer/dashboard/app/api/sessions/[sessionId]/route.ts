/**
 * Get session details with comparison data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listSessions, readRun } from '@/lib/csv-reader';
import { computeRunSummary } from '@/lib/snapshot-builder';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { sessionId } = await params;
  const sessions = await listSessions();

  // Find the requested session
  const session = sessions.find((s) => s.session_id === sessionId);

  if (!session) {
    return NextResponse.json(
      { error: 'Session not found', session_id: sessionId },
      { status: 404 }
    );
  }

  // Build comparison data for each run in the session
  const comparisonData = [];

  for (const run of session.runs) {
    const records = await readRun(run.run_id);
    const summary = computeRunSummary(records);

    if (summary) {
      comparisonData.push({
        run_id: run.run_id,
        ...summary,
      });
    }
  }

  return NextResponse.json({
    session_id: sessionId,
    started_at: session.started_at,
    ended_at: session.ended_at,
    strategies: session.strategies,
    runs: comparisonData,
  });
}
