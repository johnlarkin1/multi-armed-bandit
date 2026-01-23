'use client';

import { useState } from 'react';
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
import type { RunSummary, ServerType } from '@/types/metrics';
import { STRATEGY_COLORS, CONFIG_COLORS, isStrategy } from '@/types/metrics';
import { ViewModeToggle, type ViewMode } from '@/components/controls/ViewModeToggle';
import { ConfigLegend } from '@/components/charts/ConfigLegend';
import {
  TOOLTIP_CONTENT_STYLE,
  GRID_STROKE,
  GRID_DASH_ARRAY,
  AXIS_STROKE,
} from '@/constants/chartStyles';

interface ComparisonChartsProps {
  data: RunSummary[];
}

interface OverallChartData {
  run_id: string;
  strategy: string;
  fullStrategy: string;
  score: number;
  successRate: number;
  latencyP50: number;
  latencyP99: number;
  retries: number;
  penalty: number;
}

interface ConfigChartData {
  run_id: string;
  strategy: string;
  fullStrategy: string;
  T1_score: number;
  T2_score: number;
  T3_score: number;
  T1_successRate: number;
  T2_successRate: number;
  T3_successRate: number;
  T1_latencyP50: number;
  T2_latencyP50: number;
  T3_latencyP50: number;
  T1_retries: number;
  T2_retries: number;
  T3_retries: number;
}

export function ComparisonCharts({ data }: ComparisonChartsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overall');

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

  // Overall data for single-bar charts
  const overallData: OverallChartData[] = data.map((run) => ({
    run_id: run.run_id,
    strategy: getStrategyKey(run.strategy).toUpperCase(),
    fullStrategy: run.strategy,
    score: run.score,
    successRate: run.success_rate * 100,
    latencyP50: run.latency_p50,
    latencyP99: run.latency_p99,
    retries: run.total_retries,
    penalty: run.total_penalty,
  }));

  // Per-config data for grouped bar charts
  const configData: ConfigChartData[] = data.map((run) => {
    const getConfigMetric = (config: ServerType, metric: string) => {
      const configMetrics = run.per_config?.[config];
      if (!configMetrics) return 0;
      switch (metric) {
        case 'score':
          return configMetrics.score;
        case 'successRate':
          return configMetrics.success_rate * 100;
        case 'latencyP50':
          return configMetrics.latency_p50;
        case 'retries':
          return configMetrics.total_retries;
        default:
          return 0;
      }
    };

    return {
      run_id: run.run_id,
      strategy: getStrategyKey(run.strategy).toUpperCase(),
      fullStrategy: run.strategy,
      T1_score: getConfigMetric('T1', 'score'),
      T2_score: getConfigMetric('T2', 'score'),
      T3_score: getConfigMetric('T3', 'score'),
      T1_successRate: getConfigMetric('T1', 'successRate'),
      T2_successRate: getConfigMetric('T2', 'successRate'),
      T3_successRate: getConfigMetric('T3', 'successRate'),
      T1_latencyP50: getConfigMetric('T1', 'latencyP50'),
      T2_latencyP50: getConfigMetric('T2', 'latencyP50'),
      T3_latencyP50: getConfigMetric('T3', 'latencyP50'),
      T1_retries: getConfigMetric('T1', 'retries'),
      T2_retries: getConfigMetric('T2', 'retries'),
      T3_retries: getConfigMetric('T3', 'retries'),
    };
  });

  // Sort by strategy version
  overallData.sort((a, b) => a.strategy.localeCompare(b.strategy));
  configData.sort((a, b) => a.strategy.localeCompare(b.strategy));

  const hasConfigData = data.some((run) => run.per_config && Object.keys(run.per_config).length > 0);

  return (
    <div className="space-y-4">
      {/* View mode toggle - only show if config data is available */}
      {hasConfigData && (
        <div className="flex justify-end">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Score Chart */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Score Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            {viewMode === 'overall' ? (
              <BarChart data={overallData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
                <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
                <YAxis stroke={AXIS_STROKE} fontSize={12} />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  formatter={(value: number | undefined) => [value ?? 0, 'Score']}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Bar dataKey="score" name="Score" radius={[4, 4, 0, 0]}>
                  {overallData.map((entry) => (
                    <Cell key={entry.run_id} fill={getColor(entry.fullStrategy)} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={configData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
                <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
                <YAxis stroke={AXIS_STROKE} fontSize={12} />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Bar dataKey="T1_score" name="T1" fill={CONFIG_COLORS.T1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T2_score" name="T2" fill={CONFIG_COLORS.T2} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T3_score" name="T3" fill={CONFIG_COLORS.T3} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Success Rate Chart */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Success Rate</h3>
          <ResponsiveContainer width="100%" height={220}>
            {viewMode === 'overall' ? (
              <BarChart data={overallData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
                <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
                <YAxis stroke={AXIS_STROKE} fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Success Rate']}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Bar dataKey="successRate" name="Success Rate" radius={[4, 4, 0, 0]}>
                  {overallData.map((entry) => (
                    <Cell key={entry.run_id} fill={getColor(entry.fullStrategy)} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={configData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
                <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
                <YAxis stroke={AXIS_STROKE} fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`]}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Bar dataKey="T1_successRate" name="T1" fill={CONFIG_COLORS.T1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T2_successRate" name="T2" fill={CONFIG_COLORS.T2} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T3_successRate" name="T3" fill={CONFIG_COLORS.T3} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Latency Chart */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">
            {viewMode === 'overall' ? 'Latency (P50 / P99)' : 'Latency P50 by Config'}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            {viewMode === 'overall' ? (
              <BarChart data={overallData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
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
            ) : (
              <BarChart data={configData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
                <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
                <YAxis stroke={AXIS_STROKE} fontSize={12} tickFormatter={(v) => `${v}ms`} />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}ms`]}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Bar dataKey="T1_latencyP50" name="T1" fill={CONFIG_COLORS.T1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T2_latencyP50" name="T2" fill={CONFIG_COLORS.T2} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T3_latencyP50" name="T3" fill={CONFIG_COLORS.T3} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Retries Chart */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">
            {viewMode === 'overall' ? 'Retries & Penalties' : 'Retries by Config'}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            {viewMode === 'overall' ? (
              <BarChart data={overallData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
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
            ) : (
              <BarChart data={configData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
                <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
                <YAxis stroke={AXIS_STROKE} fontSize={12} />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Bar dataKey="T1_retries" name="T1" fill={CONFIG_COLORS.T1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T2_retries" name="T2" fill={CONFIG_COLORS.T2} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T3_retries" name="T3" fill={CONFIG_COLORS.T3} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Config legend when in byConfig mode */}
      {viewMode === 'byConfig' && (
        <div className="flex justify-center">
          <ConfigLegend showPortRanges={false} />
        </div>
      )}
    </div>
  );
}
