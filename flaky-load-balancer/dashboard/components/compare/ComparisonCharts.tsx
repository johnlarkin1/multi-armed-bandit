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
import type { RunSummary, Strategy } from '@/types/metrics';
import { STRATEGY_COLORS } from '@/types/metrics';

interface ComparisonChartsProps {
  data: RunSummary[];
}

export function ComparisonCharts({ data }: ComparisonChartsProps) {
  if (data.length === 0) {
    return null;
  }

  const getStrategyKey = (strategy: string): Strategy => {
    const match = strategy.match(/^v\d/);
    return (match ? match[0] : 'v1') as Strategy;
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

  const tooltipStyle = {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '8px 12px',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Score Chart */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Score Comparison</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="strategy" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number | undefined) => [value ?? 0, 'Score']}
              labelStyle={{ color: '#94a3b8' }}
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
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="strategy" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Success Rate']}
              labelStyle={{ color: '#94a3b8' }}
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
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="strategy" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v}ms`} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}ms`]}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
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
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="strategy" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
            <Bar dataKey="retries" name="Total Retries" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            <Bar dataKey="penalty" name="Penalty Retries" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
