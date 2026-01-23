'use client';

import { useState, Fragment } from 'react';
import { Trophy, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import type { RunSummary, ServerType, PerConfigMetrics } from '@/types/metrics';
import { STRATEGY_NAMES, STRATEGY_COLORS, CONFIG_COLORS, isStrategy } from '@/types/metrics';
import { withOpacity } from '@/constants/chartStyles';

interface ComparisonTableProps {
  data: RunSummary[];
}

interface AggregatedStrategy {
  strategyKey: string;
  strategyName: string;
  // Aggregated metrics across all runs of this strategy
  totalScore: number;
  totalRequests: number;
  totalSuccess: number;
  totalRetries: number;
  totalPenalty: number;
  avgSuccessRate: number;
  avgLatencyP50: number;
  avgLatencyP99: number;
  // Individual config data from runs
  configs: Map<ServerType, { run_id: string; metrics: PerConfigMetrics }>;
}

export function ComparisonTable({ data }: ComparisonTableProps) {
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());

  const getStrategyKey = (strategy: string) => {
    const match = strategy.match(/^v\d/);
    const candidate = match ? match[0] : 'v1';
    return isStrategy(candidate) ? candidate : 'v1';
  };

  const toggleExpanded = (strategyKey: string) => {
    setExpandedStrategies((prev) => {
      const next = new Set(prev);
      if (next.has(strategyKey)) {
        next.delete(strategyKey);
      } else {
        next.add(strategyKey);
      }
      return next;
    });
  };

  // Aggregate runs by strategy
  const strategyMap = new Map<string, AggregatedStrategy>();

  data.forEach((run) => {
    const strategyKey = getStrategyKey(run.strategy);

    if (!strategyMap.has(strategyKey)) {
      strategyMap.set(strategyKey, {
        strategyKey,
        strategyName: STRATEGY_NAMES[strategyKey] || run.strategy,
        totalScore: 0,
        totalRequests: 0,
        totalSuccess: 0,
        totalRetries: 0,
        totalPenalty: 0,
        avgSuccessRate: 0,
        avgLatencyP50: 0,
        avgLatencyP99: 0,
        configs: new Map(),
      });
    }

    const agg = strategyMap.get(strategyKey)!;

    // Add to aggregated totals
    agg.totalScore += run.score;
    agg.totalRequests += run.total_requests;
    agg.totalSuccess += run.total_success;
    agg.totalRetries += run.total_retries;
    agg.totalPenalty += run.total_penalty;

    // Store config-specific data
    if (run.per_config) {
      (['T1', 'T2', 'T3'] as ServerType[]).forEach((config) => {
        const configMetrics = run.per_config?.[config];
        if (configMetrics && configMetrics.total_requests > 0) {
          agg.configs.set(config, { run_id: run.run_id, metrics: configMetrics });
        }
      });
    }
  });

  // Calculate averages and convert to array
  const aggregatedStrategies: AggregatedStrategy[] = [];

  strategyMap.forEach((agg) => {
    const configCount = agg.configs.size;
    if (configCount > 0) {
      // Calculate weighted averages from config data
      let totalLatencyP50 = 0;
      let totalLatencyP99 = 0;
      let totalSuccessRate = 0;

      agg.configs.forEach(({ metrics }) => {
        totalLatencyP50 += metrics.latency_p50;
        totalLatencyP99 += metrics.latency_p99;
        totalSuccessRate += metrics.success_rate;
      });

      agg.avgLatencyP50 = totalLatencyP50 / configCount;
      agg.avgLatencyP99 = totalLatencyP99 / configCount;
      agg.avgSuccessRate = totalSuccessRate / configCount;
    } else if (agg.totalRequests > 0) {
      agg.avgSuccessRate = agg.totalSuccess / agg.totalRequests;
    }

    aggregatedStrategies.push(agg);
  });

  // Sort by total score descending
  aggregatedStrategies.sort((a, b) => b.totalScore - a.totalScore);

  const bestScore = aggregatedStrategies[0]?.totalScore ?? 0;

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-slate-400" />
        Strategy Comparison
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 font-medium text-slate-300 w-8"></th>
              <th className="text-left py-3 px-4 font-medium text-slate-300">Strategy</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Score</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Success Rate</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Latency P50</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Latency P99</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Retries</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Penalty</th>
            </tr>
          </thead>
          <tbody>
            {aggregatedStrategies.map((agg, index) => {
              const color = STRATEGY_COLORS[agg.strategyKey as keyof typeof STRATEGY_COLORS] || '#64748b';
              const isBest = agg.totalScore === bestScore;
              const isWorst = index === aggregatedStrategies.length - 1 && aggregatedStrategies.length > 1;
              const isExpanded = expandedStrategies.has(agg.strategyKey);
              const canExpand = agg.configs.size > 0;

              return (
                <Fragment key={agg.strategyKey}>
                  {/* Strategy aggregate row */}
                  <tr
                    className={`border-b border-slate-700/50 transition-colors ${
                      isBest ? 'bg-green-500/10' : ''
                    } ${canExpand ? 'cursor-pointer hover:bg-slate-700/30' : ''}`}
                    onClick={() => canExpand && toggleExpanded(agg.strategyKey)}
                  >
                    <td className="py-3 px-4">
                      {canExpand && (
                        <button className="text-slate-400 hover:text-slate-200">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="px-2.5 py-1 rounded text-xs font-bold"
                          style={{
                            backgroundColor: withOpacity(color, 'light'),
                            color: color,
                          }}
                        >
                          {agg.strategyKey.toUpperCase()}
                        </span>
                        <span className="text-slate-300">
                          {agg.strategyName}
                        </span>
                        <span className="text-slate-500 text-xs">
                          ({agg.configs.size} {agg.configs.size === 1 ? 'config' : 'configs'})
                        </span>
                        {isBest && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                            <Trophy className="w-3 h-3" />
                            BEST
                          </span>
                        )}
                        {isWorst && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                            <TrendingDown className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-mono font-semibold" style={{ color }}>
                      {agg.totalScore}
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-300">
                      {(agg.avgSuccessRate * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-300">
                      {agg.avgLatencyP50.toFixed(1)}ms
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-300">
                      {agg.avgLatencyP99.toFixed(1)}ms
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-400">
                      {agg.totalRetries}
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-400">
                      {agg.totalPenalty}
                    </td>
                  </tr>

                  {/* Expanded per-config rows */}
                  {isExpanded &&
                    (['T1', 'T2', 'T3'] as ServerType[]).map((configType) => {
                      const configData = agg.configs.get(configType);
                      if (!configData) return null;

                      const configColor = CONFIG_COLORS[configType];
                      const configMetrics = configData.metrics;

                      return (
                        <tr
                          key={`${agg.strategyKey}-${configType}`}
                          className="border-b border-slate-700/30 bg-slate-700/20"
                        >
                          <td className="py-2 px-4"></td>
                          <td className="py-2 px-4 pl-12">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: configColor }}
                              />
                              <span className="text-slate-400 text-xs font-medium">
                                {configType}
                              </span>
                            </div>
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs" style={{ color: configColor }}>
                            {configMetrics.score}
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs text-slate-400">
                            {(configMetrics.success_rate * 100).toFixed(1)}%
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs text-slate-400">
                            {configMetrics.latency_p50.toFixed(1)}ms
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs text-slate-400">
                            {configMetrics.latency_p99.toFixed(1)}ms
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs text-slate-500">
                            {configMetrics.total_retries}
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs text-slate-500">
                            {configMetrics.total_penalty}
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Score explanation */}
      <div className="mt-4 text-xs text-slate-500">
        Score = Successful Requests - Penalty Retries (attempts {'>'} 3). Aggregated across all configs. Click a row to expand config breakdown.
      </div>
    </div>
  );
}
