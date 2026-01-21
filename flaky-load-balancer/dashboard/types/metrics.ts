export interface PerServerMetrics {
  port: number;
  num_requests: number;
  num_success: number;
  num_failure: number;
  success_rate: number;
  avg_latency_ms: number;
}

export interface MetricsSnapshot {
  type: 'metrics' | 'connected' | 'heartbeat';
  timestamp: number;
  strategy: string;
  run_id?: string;
  total_requests: number;
  total_success: number;
  total_failure: number;
  total_retries: number;
  total_penalty: number;
  global_regret: number;
  best_guess_score: number;
  latency_p50: number;
  latency_p99: number;
  latencies: number[];
  per_server: Record<string, PerServerMetrics>;
  last_update: number;
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
  started_at: number;
  ended_at: number;
  strategies: string[];
  run_count: number;
}

export interface RunSummary {
  run_id: string;
  strategy: string;
  total_requests: number;
  total_success: number;
  success_rate: number;
  score: number;
  total_retries: number;
  total_penalty: number;
  latency_p50: number;
  latency_p99: number;
}

export type ServerType = 'T1' | 'T2' | 'T3';
export type Strategy = 'v1' | 'v2' | 'v3' | 'v4' | 'v5';
export type TimeRange = 'all' | '30s' | '1m' | '5m';

export const STRATEGY_NAMES: Record<Strategy, string> = {
  v1: 'Larkin Intuition',
  v2: 'UCB',
  v3: 'UCB Modified',
  v4: 'Thompson Sampling',
  v5: 'Thompson Modified',
};

export const STRATEGY_COLORS: Record<Strategy, string> = {
  v1: '#3B82F6', // blue
  v2: '#EF4444', // red
  v3: '#22C55E', // green
  v4: '#A855F7', // purple
  v5: '#F97316', // orange
};

export function getServerType(port: number): ServerType {
  if (port >= 4000 && port < 5000) return 'T1';
  if (port >= 5000 && port < 6000) return 'T2';
  return 'T3';
}

export function getHealthColor(successRate: number): string {
  if (successRate >= 0.8) return '#22C55E'; // green
  if (successRate >= 0.5) return '#F97316'; // orange
  return '#EF4444'; // red
}

const VALID_STRATEGIES = new Set<string>(['v1', 'v2', 'v3', 'v4', 'v5']);

/**
 * Type guard to check if a string is a valid Strategy.
 */
export function isStrategy(value: string): value is Strategy {
  return VALID_STRATEGIES.has(value);
}

/**
 * Parses a strategy from a run ID string.
 * Run ID format: "2024-01-15_14-30-45_v4_thompson"
 */
export function parseStrategyFromRunId(runId: string): Strategy | null {
  const match = runId.match(/(v\d)/);
  if (!match) return null;
  const candidate = match[1];
  return isStrategy(candidate) ? candidate : null;
}
