'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import type { RunSummary } from '@/types/metrics';
import { STRATEGY_COLORS, isStrategy } from '@/types/metrics';
import {
  TOOLTIP_CONTENT_STYLE,
  GRID_STROKE,
  GRID_DASH_ARRAY,
  AXIS_STROKE,
} from '@/constants/chartStyles';

interface ComparisonChartsProps {
  data: RunSummary[];
}

export function ComparisonCharts({ data }: ComparisonChartsProps) {
  if (data.length === 0) {
    return null;
  }

  const getStrategyKey = (strategy: string) => {
    const match = strategy.match(/^v\d/);
    const candidate = match ? match[0] : 'v1';
    return isStrategy(candidate) ? candidate : 'v1';
  };

  const getColor = (strategy: string): string => {
    const key = getStrategyKey(strategy);
    return STRATEGY_COLORS[key] || '#64748b';
  };

  const chartData = data.map((run) => ({
    strategy: getStrategyKey(run.strategy).toUpperCase(),
    fullStrategy: run.strategy,
    score: run.score,
    successRate: run.success_rate * 100,
    latencyP50: run.latency_p50,
    latencyP99: run.latency_p99,
    retries: run.total_retries,
    penalty: run.total_penalty,
  }));

  // Sort by strategy version
  chartData.sort((a, b) => a.strategy.localeCompare(b.strategy));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Score Chart */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Score Comparison</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
            <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
            <YAxis stroke={AXIS_STROKE} fontSize={12} />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              formatter={(value: number | undefined) => [value ?? 0, 'Score']}
              labelStyle={{ color: AXIS_STROKE }}
            />
            <Bar dataKey="score" name="Score" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={getColor(entry.fullStrategy)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Success Rate Chart */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Success Rate</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
            <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
            <YAxis stroke={AXIS_STROKE} fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Success Rate']}
              labelStyle={{ color: AXIS_STROKE }}
            />
            <Bar dataKey="successRate" name="Success Rate" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={getColor(entry.fullStrategy)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Latency Chart */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Latency (P50 / P99)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
            <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
            <YAxis stroke={AXIS_STROKE} fontSize={12} tickFormatter={(v) => `${v}ms`} />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}ms`]}
              labelStyle={{ color: AXIS_STROKE }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: AXIS_STROKE }} />
            <Bar dataKey="latencyP50" name="P50" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="latencyP99" name="P99" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Retries Chart */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Retries & Penalties</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
            <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
            <YAxis stroke={AXIS_STROKE} fontSize={12} />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={{ color: AXIS_STROKE }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: AXIS_STROKE }} />
            <Bar dataKey="retries" name="Total Retries" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            <Bar dataKey="penalty" name="Penalty Retries" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
