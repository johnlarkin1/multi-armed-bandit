'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { useCompare } from '@/hooks/useCompare';
import { SessionSelector } from '@/components/compare/SessionSelector';
import { ComparisonTable } from '@/components/compare/ComparisonTable';
import { ComparisonCharts } from '@/components/compare/ComparisonCharts';

interface CompareViewProps {
  sessionId?: string;
}

export function CompareView({ sessionId }: CompareViewProps) {
  const router = useRouter();
  const {
    sessions,
    selectedSessionId,
    comparisonData,
    isLoading,
    error,
    fetchSessions,
    loadSession,
    clearSession,
  } = useCompare();

  // Load session when sessionId changes
  useEffect(() => {
    if (sessionId && sessionId !== selectedSessionId) {
      loadSession(sessionId);
    } else if (!sessionId && selectedSessionId) {
      clearSession();
    }
  }, [sessionId, selectedSessionId, loadSession, clearSession]);

  const handleBackToSelector = () => {
    clearSession();
    router.push('/compare');
  };

  const handleRefresh = () => {
    fetchSessions();
    if (sessionId) {
      loadSession(sessionId);
    }
  };

  return (
    <main className="p-6 space-y-6">
      {/* Header with back button and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {sessionId && (
            <button
              onClick={handleBackToSelector}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300"
            >
              <ArrowLeft className="w-4 h-4" />
              All Sessions
            </button>
          )}
          <h1 className="text-xl font-semibold text-white">
            {sessionId ? 'Session Comparison' : 'Compare Strategies'}
          </h1>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Session selector (when no session selected) */}
      {!sessionId && (
        <SessionSelector
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          isLoading={isLoading}
        />
      )}

      {/* Comparison results (when session selected) */}
      {sessionId && comparisonData.length > 0 && (
        <>
          <ComparisonTable data={comparisonData} />
          <ComparisonCharts data={comparisonData} />
        </>
      )}

      {/* Loading state for session data */}
      {sessionId && isLoading && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-slate-700 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-slate-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when session has no data */}
      {sessionId && !isLoading && comparisonData.length === 0 && !error && (
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-400">No comparison data available for this session.</p>
        </div>
      )}
    </main>
  );
}
