'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Play, Clock, Database } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { STRATEGY_NAMES, STRATEGY_COLORS, parseStrategyFromRunId } from '@/types/metrics';
import { withOpacity } from '@/constants/chartStyles';

interface RunSelectorProps {
  onSelectRun: (runId: string) => void;
}

export function RunSelector({ onSelectRun }: RunSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { availableRuns, currentRunId, viewingRunId } = useDashboardStore((state) => ({
    availableRuns: state.availableRuns,
    currentRunId: state.currentRunId,
    viewingRunId: state.viewingRunId,
  }));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startedAt: number, endedAt: number) => {
    const durationSec = endedAt - startedAt;
    if (durationSec < 60) {
      return `${Math.round(durationSec)}s`;
    }
    const minutes = Math.floor(durationSec / 60);
    const seconds = Math.round(durationSec % 60);
    return `${minutes}m ${seconds}s`;
  };

  const currentRun = availableRuns.find((r) => r.run_id === viewingRunId);
  const currentStrategy = currentRun ? parseStrategyFromRunId(currentRun.run_id) : null;
  const strategyColor = currentStrategy ? STRATEGY_COLORS[currentStrategy] : '#64748b';

  if (availableRuns.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg text-slate-400 text-sm">
        <Database className="w-4 h-4" />
        <span>No runs available</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors min-w-[200px]"
      >
        <Database className="w-4 h-4 text-slate-400" />
        <div className="flex-1 text-left">
          {currentRun ? (
            <div className="flex items-center gap-2">
              <span
                className="px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: withOpacity(strategyColor, 'light'), color: strategyColor }}
              >
                {currentRun.strategy.split('_')[0].toUpperCase()}
              </span>
              <span className="text-sm text-white truncate">
                {formatTimestamp(currentRun.started_at)}
              </span>
              {currentRun.is_current && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <Play className="w-3 h-3 fill-current" />
                  Live
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-400">Select a run</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 max-h-96 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50">
          {availableRuns.map((run) => {
            const strategy = parseStrategyFromRunId(run.run_id);
            const color = strategy ? STRATEGY_COLORS[strategy] : '#64748b';
            const isSelected = run.run_id === viewingRunId;
            const isLive = run.run_id === currentRunId;

            return (
              <button
                key={run.run_id}
                onClick={() => {
                  onSelectRun(run.run_id);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-700 transition-colors text-left ${
                  isSelected ? 'bg-slate-700/50' : ''
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isLive ? (
                    <Play className="w-4 h-4 text-green-400 fill-current" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: withOpacity(color, 'light'), color }}
                    >
                      {run.strategy.split('_')[0].toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400">
                      {strategy && STRATEGY_NAMES[strategy]}
                    </span>
                    {isLive && (
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-white">
                    {formatTimestamp(run.started_at)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>{run.total_requests} requests</span>
                    <span>{run.total_attempts} attempts</span>
                    <span>{formatDuration(run.started_at, run.ended_at)}</span>
                  </div>
                </div>
                {isSelected && (
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
