'use client';

import { useRouter } from 'next/navigation';
import { Calendar, Layers } from 'lucide-react';
import type { SessionInfo, Strategy } from '@/types/metrics';
import { STRATEGY_COLORS } from '@/types/metrics';

interface SessionSelectorProps {
  sessions: SessionInfo[];
  selectedSessionId: string | null;
  isLoading: boolean;
}

export function SessionSelector({ sessions, selectedSessionId, isLoading }: SessionSelectorProps) {
  const router = useRouter();

  const handleSelectSession = (sessionId: string) => {
    router.push(`/compare/${sessionId}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStrategyKey = (strategy: string): Strategy => {
    // Extract v1, v2, etc. from strategy names like "v4_thompson"
    const match = strategy.match(/^v\d/);
    return (match ? match[0] : 'v1') as Strategy;
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-700 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-slate-400" />
          Select Session to Compare
        </h2>
        <div className="text-center py-8 text-slate-400">
          <p>No comparison sessions found.</p>
          <p className="text-sm mt-2">
            Run multiple strategies together using <code className="bg-slate-700 px-1.5 py-0.5 rounded">flb</code> with "ALL" to create comparison sessions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
        <Layers className="w-5 h-5 text-slate-400" />
        Select Session to Compare
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((session) => (
          <button
            key={session.session_id}
            onClick={() => handleSelectSession(session.session_id)}
            className={`p-4 rounded-lg border text-left transition-all hover:scale-[1.02] ${
              selectedSessionId === session.session_id
                ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50'
                : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
            }`}
          >
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <Calendar className="w-4 h-4" />
              {formatDate(session.started_at)}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {session.strategies.map((strategy) => {
                const key = getStrategyKey(strategy);
                const color = STRATEGY_COLORS[key];
                return (
                  <span
                    key={strategy}
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: `${color}20`,
                      color: color,
                    }}
                  >
                    {key.toUpperCase()}
                  </span>
                );
              })}
            </div>

            <div className="text-xs text-slate-500">
              {session.run_count} strategies compared
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
