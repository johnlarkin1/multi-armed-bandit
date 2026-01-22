/**
 * Build metrics snapshots from CSV attempt records.
 * Ports the logic from Python's sse.py `_build_snapshot()` function.
 */

import { AttemptRecord } from './csv-reader';
import { SNAPSHOT_WINDOW_SIZE } from './config';
import type { ServerType, PerConfigMetrics } from '@/types/metrics';

export interface PerServerMetrics {
  port: number;
  num_requests: number;
  num_success: number;
  num_failure: number;
  success_rate: number;
  avg_latency_ms: number;
}

export interface MetricsSnapshot {
  type: 'metrics';
  timestamp: number;
  strategy: string;
  run_id: string | null;
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
  per_config: Record<ServerType, PerConfigMetrics>;
  last_update: number;
}

interface PerServerAccumulator {
  port: number;
  num_requests: number;
  num_success: number;
  num_failure: number;
  total_latency_ms: number;
}

interface PerConfigAccumulator {
  config: ServerType;
  total_requests: number;
  total_success: number;
  total_failure: number;
  total_retries: number;
  total_penalty: number;
  latencies: number[];
}

/**
 * Calculate the median of an array of numbers.
 */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate the 99th percentile of an array of numbers.
 */
function percentile99(arr: number[]): number {
  if (arr.length === 0) return 0;
  if (arr.length === 1) return arr[0];

  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil(0.99 * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Build per-config metrics from accumulator.
 */
function buildPerConfigMetrics(
  perConfig: Map<ServerType, PerConfigAccumulator>
): Record<ServerType, PerConfigMetrics> {
  const result: Partial<Record<ServerType, PerConfigMetrics>> = {};

  for (const configType of ['T1', 'T2', 'T3'] as ServerType[]) {
    const acc = perConfig.get(configType);
    if (acc) {
      const successRate = acc.total_requests > 0 ? acc.total_success / acc.total_requests : 0;
      const globalRegret = acc.total_requests - acc.total_success;
      const score = acc.total_success - acc.total_penalty;
      const latencyP50 = acc.latencies.length > 0 ? median(acc.latencies) : 0;
      const latencyP99 = acc.latencies.length > 0 ? percentile99(acc.latencies) : 0;

      result[configType] = {
        config: configType,
        total_requests: acc.total_requests,
        total_success: acc.total_success,
        total_failure: acc.total_failure,
        total_retries: acc.total_retries,
        total_penalty: acc.total_penalty,
        success_rate: Math.round(successRate * 10000) / 10000,
        global_regret: globalRegret,
        score,
        latency_p50: Math.round(latencyP50 * 100) / 100,
        latency_p99: Math.round(latencyP99 * 100) / 100,
      };
    } else {
      // Create empty metrics for missing config
      result[configType] = {
        config: configType,
        total_requests: 0,
        total_success: 0,
        total_failure: 0,
        total_retries: 0,
        total_penalty: 0,
        success_rate: 0,
        global_regret: 0,
        score: 0,
        latency_p50: 0,
        latency_p99: 0,
      };
    }
  }

  return result as Record<ServerType, PerConfigMetrics>;
}

/**
 * Build a single snapshot from accumulated metrics.
 */
function buildSnapshot(
  timestamp: number,
  strategy: string,
  runId: string | null,
  totalRequests: number,
  totalSuccess: number,
  totalFailure: number,
  totalRetries: number,
  totalPenalty: number,
  latencies: number[],
  perServer: Map<number, PerServerAccumulator>,
  perConfig: Map<ServerType, PerConfigAccumulator>
): MetricsSnapshot {
  const latencyP50 = latencies.length > 0 ? median(latencies) : 0;
  const latencyP99 = latencies.length > 0 ? percentile99(latencies) : 0;

  const perServerOut: Record<string, PerServerMetrics> = {};
  for (const [port, stats] of perServer) {
    const successRate = stats.num_requests > 0 ? stats.num_success / stats.num_requests : 0;
    const avgLatency = stats.num_requests > 0 ? stats.total_latency_ms / stats.num_requests : 0;

    perServerOut[String(port)] = {
      port: stats.port,
      num_requests: stats.num_requests,
      num_success: stats.num_success,
      num_failure: stats.num_failure,
      success_rate: Math.round(successRate * 10000) / 10000,
      avg_latency_ms: Math.round(avgLatency * 100) / 100,
    };
  }

  return {
    type: 'metrics',
    timestamp,
    strategy,
    run_id: runId,
    total_requests: totalRequests,
    total_success: totalSuccess,
    total_failure: totalFailure,
    total_retries: totalRetries,
    total_penalty: totalPenalty,
    global_regret: totalRequests - totalSuccess,
    best_guess_score: totalSuccess - totalPenalty,
    latency_p50: Math.round(latencyP50 * 100) / 100,
    latency_p99: Math.round(latencyP99 * 100) / 100,
    latencies: latencies.map((l) => Math.round(l * 100) / 100),
    per_server: perServerOut,
    per_config: buildPerConfigMetrics(perConfig),
    last_update: timestamp,
  };
}

/**
 * Deep clone a per-config accumulator map.
 */
function clonePerConfig(
  perConfig: Map<ServerType, PerConfigAccumulator>
): Map<ServerType, PerConfigAccumulator> {
  const cloned = new Map<ServerType, PerConfigAccumulator>();
  for (const [key, value] of perConfig) {
    cloned.set(key, {
      ...value,
      latencies: [...value.latencies],
    });
  }
  return cloned;
}

/**
 * Build time-windowed metrics snapshots from attempt records.
 */
export function buildSnapshotsFromRecords(
  records: AttemptRecord[],
  runId: string | null
): MetricsSnapshot[] {
  if (records.length === 0) {
    return [];
  }

  const strategy = records[0].strategy;
  const startTime = records[0].timestamp;
  const windowSize = SNAPSHOT_WINDOW_SIZE;

  const snapshots: MetricsSnapshot[] = [];

  let totalRequests = 0;
  let totalSuccess = 0;
  let totalFailure = 0;
  let totalRetries = 0;
  let totalPenalty = 0;
  const latencies: number[] = [];
  const perServer = new Map<number, PerServerAccumulator>();
  const perConfig = new Map<ServerType, PerConfigAccumulator>();

  let currentWindowStart = startTime;
  let pendingRecords: AttemptRecord[] = [];

  for (const record of records) {
    // Have we moved to a new window?
    while (record.timestamp >= currentWindowStart + windowSize) {
      // Emit snapshot if we have data
      if (pendingRecords.length > 0) {
        const snapshot = buildSnapshot(
          currentWindowStart + windowSize,
          strategy,
          runId,
          totalRequests,
          totalSuccess,
          totalFailure,
          totalRetries,
          totalPenalty,
          [...latencies],
          new Map(perServer),
          clonePerConfig(perConfig)
        );
        snapshots.push(snapshot);
        pendingRecords = [];
      }

      currentWindowStart += windowSize;
    }

    // Update per-server stats
    const port = record.server_port;
    if (!perServer.has(port)) {
      perServer.set(port, {
        port,
        num_requests: 0,
        num_success: 0,
        num_failure: 0,
        total_latency_ms: 0,
      });
    }

    const serverStats = perServer.get(port)!;
    serverStats.num_requests += 1;
    serverStats.total_latency_ms += record.latency_ms;
    if (record.success) {
      serverStats.num_success += 1;
    } else {
      serverStats.num_failure += 1;
    }

    // Update per-config stats
    const configType = record.config_target;
    if (!perConfig.has(configType)) {
      perConfig.set(configType, {
        config: configType,
        total_requests: 0,
        total_success: 0,
        total_failure: 0,
        total_retries: 0,
        total_penalty: 0,
        latencies: [],
      });
    }

    const configStats = perConfig.get(configType)!;
    configStats.latencies.push(record.latency_ms);

    if (record.attempt_number > 1) {
      configStats.total_retries += 1;
    }
    if (record.attempt_number > 3) {
      configStats.total_penalty += 1;
    }
    if (record.request_complete) {
      configStats.total_requests += 1;
      if (record.request_success) {
        configStats.total_success += 1;
      } else {
        configStats.total_failure += 1;
      }
    }

    // Update global stats
    latencies.push(record.latency_ms);

    if (record.attempt_number > 1) {
      totalRetries += 1;
    }
    if (record.attempt_number > 3) {
      totalPenalty += 1;
    }
    if (record.request_complete) {
      totalRequests += 1;
      if (record.request_success) {
        totalSuccess += 1;
      } else {
        totalFailure += 1;
      }
    }

    pendingRecords.push(record);
  }

  // Emit final snapshot
  if (pendingRecords.length > 0) {
    const snapshot = buildSnapshot(
      records[records.length - 1].timestamp,
      strategy,
      runId,
      totalRequests,
      totalSuccess,
      totalFailure,
      totalRetries,
      totalPenalty,
      latencies,
      perServer,
      perConfig
    );
    snapshots.push(snapshot);
  }

  return snapshots;
}

/**
 * Compute a summary for a run (used in session comparison).
 */
export function computeRunSummary(records: AttemptRecord[]): Record<string, unknown> | null {
  if (records.length === 0) {
    return null;
  }

  const strategy = records[0].strategy;
  const totalRequests = Math.max(...records.map((r) => r.request_number));
  const totalSuccess = records.filter((r) => r.request_complete && r.request_success).length;
  const totalAttempts = records.length;
  const totalRetries = totalAttempts - totalRequests;
  const totalPenalty = records.filter((r) => r.attempt_number > 3).length;

  const latencies = records.map((r) => r.latency_ms);
  const latencyP50 = median(latencies);
  const latencyP99 = percentile99(latencies);

  const successRate = totalRequests > 0 ? totalSuccess / totalRequests : 0;
  const score = totalSuccess - totalPenalty;

  // Compute per-config metrics
  const perConfig = new Map<ServerType, PerConfigAccumulator>();

  for (const record of records) {
    const configType = record.config_target;
    if (!perConfig.has(configType)) {
      perConfig.set(configType, {
        config: configType,
        total_requests: 0,
        total_success: 0,
        total_failure: 0,
        total_retries: 0,
        total_penalty: 0,
        latencies: [],
      });
    }

    const configStats = perConfig.get(configType)!;
    configStats.latencies.push(record.latency_ms);

    if (record.attempt_number > 1) {
      configStats.total_retries += 1;
    }
    if (record.attempt_number > 3) {
      configStats.total_penalty += 1;
    }
    if (record.request_complete) {
      configStats.total_requests += 1;
      if (record.request_success) {
        configStats.total_success += 1;
      } else {
        configStats.total_failure += 1;
      }
    }
  }

  return {
    strategy,
    total_requests: totalRequests,
    total_success: totalSuccess,
    success_rate: Math.round(successRate * 10000) / 10000,
    score,
    total_retries: totalRetries,
    total_penalty: totalPenalty,
    latency_p50: Math.round(latencyP50 * 100) / 100,
    latency_p99: Math.round(latencyP99 * 100) / 100,
    per_config: buildPerConfigMetrics(perConfig),
  };
}
