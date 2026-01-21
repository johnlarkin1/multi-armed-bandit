/**
 * List all sessions (groups of related runs).
 */

import { NextResponse } from 'next/server';
import { listSessions } from '@/lib/csv-reader';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sessions = await listSessions();

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      session_id: s.session_id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      strategies: s.strategies,
      run_count: s.runs.length,
    })),
  });
}
