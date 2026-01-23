'use client';

import { useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import type { RunSummary, ServerType, PerConfigMetrics } from '@/types/metrics';
import { STRATEGY_NAMES, STRATEGY_COLORS, CONFIG_COLORS, isStrategy } from '@/types/metrics';
import { withOpacity } from '@/constants/chartStyles';

interface ComparisonTableProps {
  data: RunSummary[];
}

export function ComparisonTable({ data }: ComparisonTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Sort by score descending
  const sortedData = [...data].sort((a, b) => b.score - a.score);
  const bestScore = sortedData[0]?.score ?? 0;

  const getStrategyKey = (strategy: string) => {
    const match = strategy.match(/^v\d/);
    const candidate = match ? match[0] : 'v1';
    return isStrategy(candidate) ? candidate : 'v1';
  };

  const getStrategyDisplayName = (strategy: string): string => {
    const key = getStrategyKey(strategy);
    return STRATEGY_NAMES[key] || strategy;
  };

  const toggleExpanded = (runId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  const hasPerConfigData = (run: RunSummary): boolean => {
    return !!run.per_config && Object.keys(run.per_config).length > 0;
  };

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
            {sortedData.map((run, index) => {
              const strategyKey = getStrategyKey(run.strategy);
              const color = STRATEGY_COLORS[strategyKey] || '#64748b';
              const isBest = run.score === bestScore;
              const isWorst = index === sortedData.length - 1 && sortedData.length > 1;
              const isExpanded = expandedRows.has(run.run_id);
              const canExpand = hasPerConfigData(run);

              return (
                <>
                  <tr
                    key={run.run_id}
                    className={`border-b border-slate-700/50 transition-colors ${
                      isBest ? 'bg-green-500/10' : ''
                    } ${canExpand ? 'cursor-pointer hover:bg-slate-700/30' : ''}`}
                    onClick={() => canExpand && toggleExpanded(run.run_id)}
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
                          {strategyKey.toUpperCase()}
                        </span>
                        <span className="text-slate-300">
                          {getStrategyDisplayName(run.strategy)}
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
                      {run.score}
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-300">
                      {(run.success_rate * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-300">
                      {run.latency_p50.toFixed(1)}ms
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-300">
                      {run.latency_p99.toFixed(1)}ms
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-400">
                      {run.total_retries}
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-slate-400">
                      {run.total_penalty}
                    </td>
                  </tr>

                  {/* Expanded per-config rows */}
                  {isExpanded && run.per_config && (
                    (['T1', 'T2', 'T3'] as ServerType[]).map((configType) => {
                      const configMetrics: PerConfigMetrics | undefined = run.per_config?.[configType];
                      if (!configMetrics || configMetrics.total_requests === 0) return null;

                      const configColor = CONFIG_COLORS[configType];

                      return (
                        <tr
                          key={`${run.run_id}-${configType}`}
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
                    })
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Score explanation */}
      <div className="mt-4 text-xs text-slate-500">
        Score = Successful Requests - Penalty Retries (attempts {'>'} 3). Click a row to expand config breakdown.
      </div>
    </div>
  );
}
