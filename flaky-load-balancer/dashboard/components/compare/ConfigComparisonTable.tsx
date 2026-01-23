'use client';

import { useState, Fragment } from 'react';
import { Trophy, Server, ChevronDown, ChevronRight } from 'lucide-react';
import type { RunSummary, ServerType, PerConfigMetrics } from '@/types/metrics';
import { STRATEGY_NAMES, STRATEGY_COLORS, CONFIG_COLORS, CONFIG_PORT_RANGES, isStrategy } from '@/types/metrics';
import { withOpacity } from '@/constants/chartStyles';

interface ConfigComparisonTableProps {
  data: RunSummary[];
}

interface StrategyConfigData {
  run_id: string;
  strategy: string;
  strategyKey: string;
  metrics: PerConfigMetrics;
}

export function ConfigComparisonTable({ data }: ConfigComparisonTableProps) {
  // Expand all configs by default
  const [expandedConfigs, setExpandedConfigs] = useState<Set<ServerType>>(
    new Set(['T1', 'T2', 'T3'])
  );

  const getStrategyKey = (strategy: string) => {
    const match = strategy.match(/^v\d/);
    const candidate = match ? match[0] : 'v1';
    return isStrategy(candidate) ? candidate : 'v1';
  };

  const getStrategyDisplayName = (strategy: string): string => {
    const key = getStrategyKey(strategy);
    return STRATEGY_NAMES[key] || strategy;
  };

  const toggleConfig = (config: ServerType) => {
    setExpandedConfigs((prev) => {
      const next = new Set(prev);
      if (next.has(config)) {
        next.delete(config);
      } else {
        next.add(config);
      }
      return next;
    });
  };

  // Build data structure: config -> strategies with metrics
  const configData: Record<ServerType, StrategyConfigData[]> = {
    T1: [],
    T2: [],
    T3: [],
  };

  // Populate config data from runs
  data.forEach((run) => {
    if (!run.per_config) return;

    (['T1', 'T2', 'T3'] as ServerType[]).forEach((config) => {
      const metrics = run.per_config?.[config];
      if (metrics && metrics.total_requests > 0) {
        configData[config].push({
          run_id: run.run_id,
          strategy: run.strategy,
          strategyKey: getStrategyKey(run.strategy),
          metrics,
        });
      }
    });
  });

  // Sort each config's strategies by score descending
  (['T1', 'T2', 'T3'] as ServerType[]).forEach((config) => {
    configData[config].sort((a, b) => b.metrics.score - a.metrics.score);
  });

  // Check if we have any config data
  const hasData = Object.values(configData).some((strategies) => strategies.length > 0);

  if (!hasData) {
    return null;
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
        <Server className="w-5 h-5 text-slate-400" />
        Config Comparison
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 font-medium text-slate-300 w-8"></th>
              <th className="text-left py-3 px-4 font-medium text-slate-300">Config / Strategy</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Score</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Success Rate</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Latency P50</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Latency P99</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Retries</th>
              <th className="text-right py-3 px-4 font-medium text-slate-300">Penalty</th>
            </tr>
          </thead>
          <tbody>
            {(['T1', 'T2', 'T3'] as ServerType[]).map((config) => {
              const strategies = configData[config];
              if (strategies.length === 0) return null;

              const isExpanded = expandedConfigs.has(config);
              const configColor = CONFIG_COLORS[config];
              const portRange = CONFIG_PORT_RANGES[config];
              const bestScore = strategies[0]?.metrics.score ?? 0;

              // Aggregate scores for config row
              const avgScore = strategies.reduce((sum, s) => sum + s.metrics.score, 0) / strategies.length;
              const avgSuccessRate =
                strategies.reduce((sum, s) => sum + s.metrics.success_rate, 0) / strategies.length;
              const avgLatencyP50 =
                strategies.reduce((sum, s) => sum + s.metrics.latency_p50, 0) / strategies.length;
              const avgLatencyP99 =
                strategies.reduce((sum, s) => sum + s.metrics.latency_p99, 0) / strategies.length;
              const totalRetries = strategies.reduce((sum, s) => sum + s.metrics.total_retries, 0);
              const totalPenalty = strategies.reduce((sum, s) => sum + s.metrics.total_penalty, 0);

              return (
                <Fragment key={config}>
                  {/* Config header row */}
                  <tr
                    className="border-b border-slate-700/50 bg-slate-700/30 cursor-pointer hover:bg-slate-700/50 transition-colors"
                    onClick={() => toggleConfig(config)}
                  >
                    <td className="py-3 px-4">
                      <button className="text-slate-400 hover:text-slate-200">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: configColor }}
                        />
                        <div>
                          <span className="font-semibold text-slate-200">{config}</span>
                          <span className="text-slate-500 text-xs ml-2">
                            (Ports {portRange.start}-{portRange.end})
                          </span>
                        </div>
                        <span className="text-slate-500 text-xs">
                          {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-400">
                      {avgScore.toFixed(1)}
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-400">
                      {(avgSuccessRate * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-400">
                      {avgLatencyP50.toFixed(1)}ms
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-400">
                      {avgLatencyP99.toFixed(1)}ms
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-500">
                      {totalRetries}
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-500">
                      {totalPenalty}
                    </td>
                  </tr>

                  {/* Expanded strategy rows */}
                  {isExpanded &&
                    strategies.map((strategyData) => {
                      const color = STRATEGY_COLORS[strategyData.strategyKey as keyof typeof STRATEGY_COLORS] || '#64748b';
                      const isBest = strategyData.metrics.score === bestScore;

                      return (
                        <tr
                          key={`${config}-${strategyData.run_id}`}
                          className="border-b border-slate-700/30 bg-slate-800/50"
                        >
                          <td className="py-2 px-4"></td>
                          <td className="py-2 px-4 pl-12">
                            <div className="flex items-center gap-3">
                              <span
                                className="px-2 py-0.5 rounded text-xs font-bold"
                                style={{
                                  backgroundColor: withOpacity(color, 'light'),
                                  color: color,
                                }}
                              >
                                {strategyData.strategyKey.toUpperCase()}
                              </span>
                              <span className="text-slate-400 text-xs">
                                {getStrategyDisplayName(strategyData.strategy)}
                              </span>
                              {isBest && strategies.length > 1 && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                                  <Trophy className="w-3 h-3" />
                                  BEST
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs font-semibold" style={{ color }}>
                            {strategyData.metrics.score}
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs text-slate-400">
                            {(strategyData.metrics.success_rate * 100).toFixed(1)}%
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs text-slate-400">
                            {strategyData.metrics.latency_p50.toFixed(1)}ms
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs text-slate-400">
                            {strategyData.metrics.latency_p99.toFixed(1)}ms
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs text-slate-500">
                            {strategyData.metrics.total_retries}
                          </td>
                          <td className="text-right py-2 px-4 font-mono text-xs text-slate-500">
                            {strategyData.metrics.total_penalty}
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

      {/* Explanation */}
      <div className="mt-4 text-xs text-slate-500">
        Grouped by server config (T1/T2/T3). Strategies sorted by score within each config. Click a config to expand/collapse.
      </div>
    </div>
  );
}
