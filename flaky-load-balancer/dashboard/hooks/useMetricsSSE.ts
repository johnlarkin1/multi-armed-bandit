'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { MetricsSnapshot, RunInfo, Strategy } from '@/types/metrics';

const SSE_URL = '/api/events';
const HISTORY_URL = '/api/history/snapshots';
const RUNS_URL = '/api/runs';

interface HistoryResponse {
  snapshots: MetricsSnapshot[];
  strategy: Strategy | null;
  run_id: string | null;
}

interface RunsResponse {
  runs: RunInfo[];
  current_run_id: string | null;
}

export function useMetricsSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);

  const {
    viewingRunId,
    setConnected,
    setStrategy,
    addSnapshot,
    clearHistory,
    loadFromHistory,
    setAvailableRuns,
    setCurrentRunId,
  } = useDashboardStore(
    useShallow((state) => ({
      viewingRunId: state.viewingRunId,
      setConnected: state.setConnected,
      setStrategy: state.setStrategy,
      addSnapshot: state.addSnapshot,
      clearHistory: state.clearHistory,
      loadFromHistory: state.loadFromHistory,
      setAvailableRuns: state.setAvailableRuns,
      setCurrentRunId: state.setCurrentRunId,
    }))
  );

  // Fetch list of available runs
  const fetchRuns = useCallback(async (): Promise<RunsResponse | null> => {
    try {
      const response = await fetch(RUNS_URL);
      if (!response.ok) {
        return null;
      }
      const data: RunsResponse = await response.json();
      setAvailableRuns(data.runs);
      setCurrentRunId(data.current_run_id);
      return data;
    } catch {
      return null;
    }
  }, [setAvailableRuns, setCurrentRunId]);

  // Fetch historical data for a specific run
  const fetchHistory = useCallback(async (runId?: string): Promise<boolean> => {
    try {
      const url = runId ? `${HISTORY_URL}?run_id=${encodeURIComponent(runId)}` : HISTORY_URL;
      const response = await fetch(url);
      if (!response.ok) {
        return false;
      }
      const data: HistoryResponse = await response.json();
      if (data.snapshots.length > 0) {
        loadFromHistory(data.snapshots, data.strategy, data.run_id);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [loadFromHistory]);

  // Connect to SSE for live updates
  const connectSSE = useCallback(() => {
    const eventSource = new EventSource(SSE_URL);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      setConnected(true);

      const newStrategy = data.strategy as Strategy;
      const newRunId = data.run_id as string | null;

      // Update current run ID from server
      if (newRunId) {
        setCurrentRunId(newRunId);
      }

      // Check if strategy changed - if so, clear history and start fresh
      const currentStrategy = useDashboardStore.getState().currentStrategy;
      if (currentStrategy && currentStrategy !== newStrategy) {
        clearHistory();
      }
      setStrategy(newStrategy);
    });

    eventSource.addEventListener('metrics', (event) => {
      const snapshot: MetricsSnapshot = JSON.parse(event.data);
      addSnapshot(snapshot);
    });

    eventSource.addEventListener('heartbeat', () => {
      // Keep-alive, no action needed
    });

    // Handle unavailable event (FastAPI not running)
    eventSource.addEventListener('unavailable', () => {
      setConnected(false);
      // Close the connection since FastAPI is not available
      eventSource.close();
    });

    eventSource.onerror = () => {
      setConnected(false);
      // Reconnection is automatic with EventSource
    };

    return eventSource;
  }, [setConnected, setStrategy, addSnapshot, clearHistory, setCurrentRunId]);

  // Effect to load a specific run when viewingRunId changes
  useEffect(() => {
    if (viewingRunId) {
      const currentRunId = useDashboardStore.getState().currentRunId;
      // Only fetch if viewing a different (historical) run
      if (viewingRunId !== currentRunId) {
        fetchHistory(viewingRunId);
      }
    }
  }, [viewingRunId, fetchHistory]);

  // Main initialization effect
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const init = async () => {
      // First, fetch available runs
      const runsData = await fetchRuns();

      // Try to fetch historical data for the current/most recent run
      if (runsData?.runs && runsData.runs.length > 0) {
        // Load the most recent run (first in the list since sorted by time desc)
        const mostRecentRun = runsData.runs[0];
        await fetchHistory(mostRecentRun.run_id);
      }

      // Then connect to SSE for live updates
      eventSource = connectSSE();
    };

    init();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      setConnected(false);
    };
  }, [fetchRuns, fetchHistory, connectSSE, setConnected]);

  // Expose functions for manual refresh
  const refreshRuns = useCallback(async () => {
    return fetchRuns();
  }, [fetchRuns]);

  const refreshHistory = useCallback(async (runId?: string) => {
    return fetchHistory(runId);
  }, [fetchHistory]);

  const loadRun = useCallback(async (runId: string) => {
    useDashboardStore.getState().selectRun(runId);
    // The useEffect above will handle fetching if it's a historical run
    // If it's the current run, we're already receiving live updates
  }, []);

  return { eventSourceRef, refreshRuns, refreshHistory, loadRun };
}
