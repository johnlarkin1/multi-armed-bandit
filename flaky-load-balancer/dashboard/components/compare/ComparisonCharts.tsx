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
  TOOLTIP_ITEM_STYLE,
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
  T1_latencyP99: number;
  T2_latencyP99: number;
  T3_latencyP99: number;
  T1_retries: number;
  T2_retries: number;
  T3_retries: number;
  T1_penalty: number;
  T2_penalty: number;
  T3_penalty: number;
}

export function ComparisonCharts({ data }: ComparisonChartsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('byConfig');

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

  // Aggregate runs by strategy
  interface StrategyAggregation {
    strategyKey: string;
    fullStrategy: string;
    totalScore: number;
    totalSuccessRate: number;
    totalLatencyP50: number;
    totalLatencyP99: number;
    totalRetries: number;
    totalPenalty: number;
    runCount: number;
    // Per-config aggregated data
    configs: Map<ServerType, {
      totalScore: number;
      totalSuccessRate: number;
      totalLatencyP50: number;
      totalLatencyP99: number;
      totalRetries: number;
      totalPenalty: number;
      count: number;
    }>;
  }

  const strategyMap = new Map<string, StrategyAggregation>();

  data.forEach((run) => {
    const strategyKey = getStrategyKey(run.strategy);

    if (!strategyMap.has(strategyKey)) {
      strategyMap.set(strategyKey, {
        strategyKey,
        fullStrategy: run.strategy,
        totalScore: 0,
        totalSuccessRate: 0,
        totalLatencyP50: 0,
        totalLatencyP99: 0,
        totalRetries: 0,
        totalPenalty: 0,
        runCount: 0,
        configs: new Map(),
      });
    }

    const agg = strategyMap.get(strategyKey)!;
    agg.runCount++;
    agg.totalScore += run.score;
    agg.totalSuccessRate += run.success_rate * 100;
    agg.totalLatencyP50 += run.latency_p50;
    agg.totalLatencyP99 += run.latency_p99;
    agg.totalRetries += run.total_retries;
    agg.totalPenalty += run.total_penalty;

    // Aggregate per-config data
    if (run.per_config) {
      (['T1', 'T2', 'T3'] as ServerType[]).forEach((config) => {
        const configMetrics = run.per_config?.[config];
        // Only include configs with actual requests (matches table behavior)
        if (configMetrics && configMetrics.total_requests > 0) {
          if (!agg.configs.has(config)) {
            agg.configs.set(config, {
              totalScore: 0,
              totalSuccessRate: 0,
              totalLatencyP50: 0,
              totalLatencyP99: 0,
              totalRetries: 0,
              totalPenalty: 0,
              count: 0,
            });
          }
          const configAgg = agg.configs.get(config)!;
          configAgg.totalScore += configMetrics.score;
          configAgg.totalSuccessRate += configMetrics.success_rate * 100;
          configAgg.totalLatencyP50 += configMetrics.latency_p50;
          configAgg.totalLatencyP99 += configMetrics.latency_p99;
          configAgg.totalRetries += configMetrics.total_retries;
          configAgg.totalPenalty += configMetrics.total_penalty;
          configAgg.count++;
        }
      });
    }
  });

  // Convert aggregated data to chart format
  const overallData: OverallChartData[] = Array.from(strategyMap.values()).map((agg) => ({
    run_id: agg.strategyKey, // Use strategy key as unique identifier
    strategy: agg.strategyKey.toUpperCase(),
    fullStrategy: agg.fullStrategy,
    score: agg.totalScore, // Sum of all run scores
    successRate: agg.runCount > 0 ? agg.totalSuccessRate / agg.runCount : 0, // Average
    latencyP50: agg.runCount > 0 ? agg.totalLatencyP50 / agg.runCount : 0, // Average
    latencyP99: agg.runCount > 0 ? agg.totalLatencyP99 / agg.runCount : 0, // Average
    retries: agg.totalRetries, // Sum
    penalty: agg.totalPenalty, // Sum
  }));

  // Per-config data for grouped bar charts (aggregated by strategy)
  const configData: ConfigChartData[] = Array.from(strategyMap.values()).map((agg) => {
    const getAggConfigMetric = (config: ServerType, metric: 'score' | 'successRate' | 'latencyP50' | 'latencyP99' | 'retries' | 'penalty') => {
      const configAgg = agg.configs.get(config);
      if (!configAgg || configAgg.count === 0) return 0;
      switch (metric) {
        case 'score':
          return configAgg.totalScore; // Sum
        case 'successRate':
          return configAgg.totalSuccessRate / configAgg.count; // Average
        case 'latencyP50':
          return configAgg.totalLatencyP50 / configAgg.count; // Average
        case 'latencyP99':
          return configAgg.totalLatencyP99 / configAgg.count; // Average
        case 'retries':
          return configAgg.totalRetries; // Sum
        case 'penalty':
          return configAgg.totalPenalty; // Sum
      }
    };

    return {
      run_id: agg.strategyKey,
      strategy: agg.strategyKey.toUpperCase(),
      fullStrategy: agg.fullStrategy,
      T1_score: getAggConfigMetric('T1', 'score'),
      T2_score: getAggConfigMetric('T2', 'score'),
      T3_score: getAggConfigMetric('T3', 'score'),
      T1_successRate: getAggConfigMetric('T1', 'successRate'),
      T2_successRate: getAggConfigMetric('T2', 'successRate'),
      T3_successRate: getAggConfigMetric('T3', 'successRate'),
      T1_latencyP50: getAggConfigMetric('T1', 'latencyP50'),
      T2_latencyP50: getAggConfigMetric('T2', 'latencyP50'),
      T3_latencyP50: getAggConfigMetric('T3', 'latencyP50'),
      T1_latencyP99: getAggConfigMetric('T1', 'latencyP99'),
      T2_latencyP99: getAggConfigMetric('T2', 'latencyP99'),
      T3_latencyP99: getAggConfigMetric('T3', 'latencyP99'),
      T1_retries: getAggConfigMetric('T1', 'retries'),
      T2_retries: getAggConfigMetric('T2', 'retries'),
      T3_retries: getAggConfigMetric('T3', 'retries'),
      T1_penalty: getAggConfigMetric('T1', 'penalty'),
      T2_penalty: getAggConfigMetric('T2', 'penalty'),
      T3_penalty: getAggConfigMetric('T3', 'penalty'),
    };
  });

  // Sort by strategy version
  overallData.sort((a, b) => a.strategy.localeCompare(b.strategy));
  configData.sort((a, b) => a.strategy.localeCompare(b.strategy));

  const hasConfigData = data.some((run) => run.per_config && Object.keys(run.per_config).length > 0);

  return (
    <div className="space-y-4">
      {/* Section header and view mode toggle */}
      <h2 className="text-lg font-semibold text-slate-200 mb-2">Performance Breakdown</h2>
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
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  formatter={(value: number | undefined) => [value ?? 0, 'Score']}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: AXIS_STROKE }} />
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
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: AXIS_STROKE }} />
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
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Success Rate']}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: AXIS_STROKE }} />
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
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  formatter={(value: number | undefined, name: string) => [`${(value ?? 0).toFixed(1)}%`, name]}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: AXIS_STROKE }} />
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
            {viewMode === 'overall' ? 'Latency (P50 / P99)' : 'Latency (P50 / P99) by Config'}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            {viewMode === 'overall' ? (
              <BarChart data={overallData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
                <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
                <YAxis stroke={AXIS_STROKE} fontSize={12} tickFormatter={(v) => `${v}ms`} />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
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
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  formatter={(value: number | undefined, name: string) => [`${(value ?? 0).toFixed(1)}ms`, name]}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: AXIS_STROKE }} />
                <Bar dataKey="T1_latencyP50" name="T1 P50" fill={CONFIG_COLORS.T1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T1_latencyP99" name="T1 P99" fill={CONFIG_COLORS.T1} fillOpacity={0.5} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T2_latencyP50" name="T2 P50" fill={CONFIG_COLORS.T2} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T2_latencyP99" name="T2 P99" fill={CONFIG_COLORS.T2} fillOpacity={0.5} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T3_latencyP50" name="T3 P50" fill={CONFIG_COLORS.T3} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T3_latencyP99" name="T3 P99" fill={CONFIG_COLORS.T3} fillOpacity={0.5} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Retries Chart */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">
            {viewMode === 'overall' ? 'Retries & Penalties' : 'Retries & Penalties by Config'}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            {viewMode === 'overall' ? (
              <BarChart data={overallData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
                <XAxis dataKey="strategy" stroke={AXIS_STROKE} fontSize={12} />
                <YAxis stroke={AXIS_STROKE} fontSize={12} />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
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
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={{ color: AXIS_STROKE }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: AXIS_STROKE }} />
                <Bar dataKey="T1_retries" name="T1 Retries" fill={CONFIG_COLORS.T1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T1_penalty" name="T1 Penalty" fill={CONFIG_COLORS.T1} fillOpacity={0.5} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T2_retries" name="T2 Retries" fill={CONFIG_COLORS.T2} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T2_penalty" name="T2 Penalty" fill={CONFIG_COLORS.T2} fillOpacity={0.5} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T3_retries" name="T3 Retries" fill={CONFIG_COLORS.T3} radius={[4, 4, 0, 0]} />
                <Bar dataKey="T3_penalty" name="T3 Penalty" fill={CONFIG_COLORS.T3} fillOpacity={0.5} radius={[4, 4, 0, 0]} />
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
