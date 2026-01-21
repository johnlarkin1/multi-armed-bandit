'use client';

import { useDashboardStore } from '@/stores/dashboardStore';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}

function MetricCard({ label, value, subValue, color = 'text-white' }: MetricCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
    </div>
  );
}

export function StatsPanel() {
  const history = useDashboardStore((state) => state.history);
  const replayIndex = useDashboardStore((state) => state.replayIndex);
  const isLive = useDashboardStore((state) => state.isLive);

  // Get current snapshot based on live/replay state
  const snapshot = history.length === 0
    ? null
    : isLive
      ? history[history.length - 1]
      : history[replayIndex] ?? null;

  if (!snapshot) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Total Requests" value="—" />
        <MetricCard label="Success Rate" value="—" />
        <MetricCard label="Score" value="—" />
        <MetricCard label="P50 Latency" value="—" />
        <MetricCard label="P99 Latency" value="—" />
      </div>
    );
  }

  const successRate =
    snapshot.total_requests > 0
      ? ((snapshot.total_success / snapshot.total_requests) * 100).toFixed(1)
      : '0.0';

  const successRateColor =
    parseFloat(successRate) >= 80
      ? 'text-green-400'
      : parseFloat(successRate) >= 50
        ? 'text-orange-400'
        : 'text-red-400';

  const scoreColor = snapshot.best_guess_score >= 0 ? 'text-green-400' : 'text-red-400';

  // Calculate elapsed time for subvalue
  const startTime = history[0]?.timestamp ?? snapshot.timestamp;
  const currentIndex = isLive ? history.length - 1 : replayIndex;
  const elapsed = snapshot.timestamp - startTime;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <MetricCard
        label="Total Requests"
        value={snapshot.total_requests.toLocaleString()}
        subValue={`${snapshot.total_retries} retries`}
      />
      <MetricCard
        label="Success Rate"
        value={`${successRate}%`}
        color={successRateColor}
        subValue={`${snapshot.total_success}/${snapshot.total_requests}`}
      />
      <MetricCard
        label="Score"
        value={snapshot.best_guess_score}
        color={scoreColor}
        subValue={`${snapshot.total_penalty} penalties`}
      />
      <MetricCard
        label="P50 Latency"
        value={`${snapshot.latency_p50.toFixed(0)}ms`}
        color="text-blue-400"
      />
      <MetricCard
        label="P99 Latency"
        value={`${snapshot.latency_p99.toFixed(0)}ms`}
        color="text-purple-400"
        subValue={`Frame ${currentIndex + 1}/${history.length} • ${elapsed.toFixed(1)}s`}
      />
    </div>
  );
}
