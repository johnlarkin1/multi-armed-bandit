'use client';

import { useCallback, useEffect } from 'react';
import { useCompareStore } from '@/stores/compareStore';
import type { SessionInfo, RunSummary } from '@/types/metrics';

const API_BASE = '/api';

interface SessionsResponse {
  sessions: SessionInfo[];
}

interface SessionDetailResponse {
  session_id: string;
  started_at: number;
  ended_at: number;
  strategies: string[];
  runs: RunSummary[];
}

export function useCompare() {
  const {
    sessions,
    selectedSessionId,
    comparisonData,
    isLoading,
    error,
    setSessions,
    selectSession,
    setComparisonData,
    setLoading,
    setError,
  } = useCompareStore();

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/sessions`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }
      const data: SessionsResponse = await response.json();
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, [setSessions, setLoading, setError]);

  const loadSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    selectSession(sessionId);

    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.statusText}`);
      }
      const data: SessionDetailResponse = await response.json();

      if ('error' in data) {
        throw new Error((data as { error: string }).error);
      }

      setComparisonData(data.runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
      setComparisonData([]);
    } finally {
      setLoading(false);
    }
  }, [selectSession, setComparisonData, setLoading, setError]);

  const clearSession = useCallback(() => {
    selectSession(null);
    setComparisonData([]);
  }, [selectSession, setComparisonData]);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    selectedSessionId,
    comparisonData,
    isLoading,
    error,
    fetchSessions,
    loadSession,
    clearSession,
  };
}
