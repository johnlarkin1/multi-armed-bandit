'use client';

import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import type { RunSummary, Strategy } from '@/types/metrics';
import { STRATEGY_NAMES, STRATEGY_COLORS } from '@/types/metrics';

interface ComparisonTableProps {
  data: RunSummary[];
}

export function ComparisonTable({ data }: ComparisonTableProps) {
  // Sort by score descending
  const sortedData = [...data].sort((a, b) => b.score - a.score);
  const bestScore = sortedData[0]?.score ?? 0;

  const getStrategyKey = (strategy: string): Strategy => {
    const match = strategy.match(/^v\d/);
    return (match ? match[0] : 'v1') as Strategy;
  };

  const getStrategyDisplayName = (strategy: string): string => {
    const key = getStrategyKey(strategy);
    return STRATEGY_NAMES[key] || strategy;
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

              return (
                <tr
                  key={run.run_id}
                  className={`border-b border-slate-700/50 transition-colors ${
                    isBest ? 'bg-green-500/10' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="px-2.5 py-1 rounded text-xs font-bold"
                        style={{
                          backgroundColor: `${color}25`,
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Score explanation */}
      <div className="mt-4 text-xs text-slate-500">
        Score = Successful Requests - Penalty Retries (attempts {'>'} 3)
      </div>
    </div>
  );
}
