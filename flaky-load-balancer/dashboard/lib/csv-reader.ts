/**
 * CSV file reading utilities for loading historical run data.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { RUNS_DIR } from './config';

export interface AttemptRecord {
  session_id: string | null;
  request_number: number;
  attempt_number: number;
  request_id: string;
  strategy: string;
  timestamp: number;
  server_port: number;
  success: boolean;
  latency_ms: number;
  request_complete: boolean;
  request_success: boolean;
}

export interface RunInfo {
  run_id: string;
  session_id: string | null;
  strategy: string;
  started_at: number;
  ended_at: number;
  total_requests: number;
  total_attempts: number;
  is_current: boolean;
}

export interface SessionInfo {
  session_id: string;
  runs: RunInfo[];
  started_at: number;
  ended_at: number;
  strategies: string[];
}

/**
 * Get the absolute path to the runs directory.
 */
function getRunsDir(): string {
  return path.resolve(process.cwd(), RUNS_DIR);
}

/**
 * Parse a CSV line into an array of values.
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);

  return values;
}

/**
 * Parse a CSV file into an array of records.
 */
function parseCSV(content: string): AttemptRecord[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const records: AttemptRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    records.push({
      session_id: row.session_id || null,
      request_number: parseInt(row.request_number, 10),
      attempt_number: parseInt(row.attempt_number, 10),
      request_id: row.request_id,
      strategy: row.strategy,
      timestamp: parseFloat(row.timestamp),
      server_port: parseInt(row.server_port, 10),
      success: row.success === 'True',
      latency_ms: parseFloat(row.latency_ms),
      request_complete: row.request_complete === 'True',
      request_success: row.request_success === 'True',
    });
  }

  return records;
}

/**
 * List all available runs with metadata.
 */
export async function listRuns(): Promise<RunInfo[]> {
  const runsDir = getRunsDir();

  try {
    const files = await fs.readdir(runsDir);
    const csvFiles = files
      .filter((f) => f.endsWith('.csv'))
      .sort()
      .reverse();

    const runs: RunInfo[] = [];

    for (const file of csvFiles) {
      const runId = file.replace('.csv', '');
      const filePath = path.join(runsDir, file);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const records = parseCSV(content);

        if (records.length > 0) {
          const sessionId = records[0].session_id;
          const strategy = records[0].strategy;
          const startedAt = records[0].timestamp;
          const endedAt = records[records.length - 1].timestamp;
          const totalRequests = Math.max(...records.map((r) => r.request_number));
          const totalAttempts = records.length;

          runs.push({
            run_id: runId,
            session_id: sessionId,
            strategy,
            started_at: startedAt,
            ended_at: endedAt,
            total_requests: totalRequests,
            total_attempts: totalAttempts,
            is_current: false, // Will be updated by API route if FastAPI provides current run
          });
        }
      } catch {
        // Skip files that can't be read
        continue;
      }
    }

    return runs;
  } catch {
    // If runs directory doesn't exist, return empty array
    return [];
  }
}

/**
 * List all sessions with their grouped runs.
 */
export async function listSessions(): Promise<SessionInfo[]> {
  const runs = await listRuns();

  // Group runs by session_id
  const sessionsMap = new Map<string, RunInfo[]>();

  for (const run of runs) {
    if (run.session_id) {
      const existing = sessionsMap.get(run.session_id) || [];
      existing.push(run);
      sessionsMap.set(run.session_id, existing);
    }
  }

  // Build SessionInfo objects
  const sessions: SessionInfo[] = [];

  for (const [sessionId, sessionRuns] of sessionsMap) {
    // Sort runs by start time
    sessionRuns.sort((a, b) => a.started_at - b.started_at);

    const strategies = sessionRuns.map((r) => r.strategy);

    sessions.push({
      session_id: sessionId,
      runs: sessionRuns,
      started_at: sessionRuns[0].started_at,
      ended_at: sessionRuns[sessionRuns.length - 1].ended_at,
      strategies,
    });
  }

  // Sort sessions by start time (most recent first)
  sessions.sort((a, b) => b.started_at - a.started_at);

  return sessions;
}

/**
 * Read all records from a specific run.
 */
export async function readRun(runId: string): Promise<AttemptRecord[]> {
  const runsDir = getRunsDir();
  const filePath = path.join(runsDir, `${runId}.csv`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseCSV(content);
  } catch {
    return [];
  }
}

/**
 * Get the most recent run.
 */
export async function getMostRecentRun(): Promise<{ runId: string; records: AttemptRecord[] } | null> {
  const runs = await listRuns();

  if (runs.length === 0) {
    return null;
  }

  const mostRecentRunId = runs[0].run_id;
  const records = await readRun(mostRecentRunId);

  return { runId: mostRecentRunId, records };
}
