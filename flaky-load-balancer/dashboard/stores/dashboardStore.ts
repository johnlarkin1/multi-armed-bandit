import { create } from 'zustand';
import type { MetricsSnapshot, RunInfo, ServerType, Strategy, TimeRange } from '@/types/metrics';

interface DashboardState {
  // Connection state
  isConnected: boolean;
  currentStrategy: Strategy | null;
  hasHistoricalData: boolean;

  // Run management
  availableRuns: RunInfo[];
  currentRunId: string | null;      // The run that's currently active on the server
  viewingRunId: string | null;      // The run we're currently viewing
  liveRunDetected: string | null;   // Set when a new live run is detected while viewing history

  // Metrics history for replay
  history: MetricsSnapshot[];
  maxHistorySize: number;

  // Replay state
  isLive: boolean;
  replayIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;

  // Filter state
  selectedServerTypes: ServerType[];
  timeRange: TimeRange;

  // Actions
  setConnected: (connected: boolean) => void;
  setStrategy: (strategy: Strategy) => void;
  addSnapshot: (snapshot: MetricsSnapshot) => void;
  loadFromHistory: (snapshots: MetricsSnapshot[], strategy: Strategy | null, runId: string | null) => void;
  clearHistory: () => void;

  // Run management actions
  setAvailableRuns: (runs: RunInfo[]) => void;
  setCurrentRunId: (runId: string | null) => void;
  selectRun: (runId: string) => void;
  setLiveRunDetected: (runId: string | null) => void;
  joinLiveRun: () => void;

  // Replay actions
  goLive: () => void;
  startReplay: () => void;
  setReplayIndex: (index: number) => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  stepForward: () => void;
  stepBackward: () => void;

  // Filter actions
  toggleServerType: (type: ServerType) => void;
  setTimeRange: (range: TimeRange) => void;

  // Computed
  getCurrentSnapshot: () => MetricsSnapshot | null;
  isViewingLiveRun: () => boolean;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Initial state
  isConnected: false,
  currentStrategy: null,
  hasHistoricalData: false,
  availableRuns: [],
  currentRunId: null,
  viewingRunId: null,
  liveRunDetected: null,
  history: [],
  maxHistorySize: 1000, // ~8 minutes at 500ms intervals
  isLive: true,
  replayIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  selectedServerTypes: ['T1', 'T2', 'T3'],
  timeRange: 'all',

  // Actions
  setConnected: (connected) => set({ isConnected: connected }),

  setStrategy: (strategy) => set({ currentStrategy: strategy }),

  addSnapshot: (snapshot) =>
    set((state) => {
      const snapshotRunId = snapshot.run_id;

      // If we're viewing a different run than what's coming in, detect the live run
      if (snapshotRunId && state.viewingRunId && snapshotRunId !== state.viewingRunId) {
        // New live run detected while viewing historical data
        return {
          liveRunDetected: snapshotRunId,
          currentRunId: snapshotRunId,
        };
      }

      // If we're viewing the live run or no specific run, add to history
      if (!state.viewingRunId || state.viewingRunId === snapshotRunId) {
        const newHistory = [...state.history, snapshot];
        // Trim if exceeding max size
        if (newHistory.length > state.maxHistorySize) {
          newHistory.shift();
        }
        return {
          history: newHistory,
          currentRunId: snapshotRunId || state.currentRunId,
          viewingRunId: snapshotRunId || state.viewingRunId,
          // Auto-update replayIndex if live
          replayIndex: state.isLive ? newHistory.length - 1 : state.replayIndex,
        };
      }

      return state;
    }),

  loadFromHistory: (snapshots, strategy, runId) =>
    set({
      history: snapshots,
      currentStrategy: strategy,
      hasHistoricalData: snapshots.length > 0,
      viewingRunId: runId,
      replayIndex: snapshots.length > 0 ? snapshots.length - 1 : 0,
      isLive: false, // Start in replay mode when loading history
      isPlaying: false,
      liveRunDetected: null,
    }),

  clearHistory: () =>
    set({
      history: [],
      replayIndex: 0,
      isLive: true,
      isPlaying: false,
      hasHistoricalData: false,
      viewingRunId: null,
      liveRunDetected: null,
    }),

  // Run management
  setAvailableRuns: (runs) => set({ availableRuns: runs }),

  setCurrentRunId: (runId) => set({ currentRunId: runId }),

  selectRun: (runId) =>
    set((state) => {
      // If selecting the current live run, go live
      if (runId === state.currentRunId) {
        return {
          viewingRunId: runId,
          isLive: true,
          liveRunDetected: null,
        };
      }
      // Otherwise, we'll need to fetch that run's data
      return {
        viewingRunId: runId,
        isLive: false,
        liveRunDetected: null,
      };
    }),

  setLiveRunDetected: (runId) => set({ liveRunDetected: runId }),

  joinLiveRun: () =>
    set((state) => ({
      viewingRunId: state.liveRunDetected || state.currentRunId,
      isLive: true,
      liveRunDetected: null,
      history: [], // Clear history to load fresh from live run
      hasHistoricalData: false,
    })),

  goLive: () =>
    set((state) => ({
      isLive: true,
      replayIndex: state.history.length - 1,
      isPlaying: false,
    })),

  startReplay: () =>
    set({
      isLive: false,
      isPlaying: false,
    }),

  setReplayIndex: (index) =>
    set((state) => ({
      replayIndex: Math.max(0, Math.min(index, state.history.length - 1)),
      isLive: false,
    })),

  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  stepForward: () =>
    set((state) => ({
      replayIndex: Math.min(state.replayIndex + 1, state.history.length - 1),
      isLive: false,
    })),

  stepBackward: () =>
    set((state) => ({
      replayIndex: Math.max(state.replayIndex - 1, 0),
      isLive: false,
    })),

  toggleServerType: (type) =>
    set((state) => {
      const selected = state.selectedServerTypes;
      return {
        selectedServerTypes: selected.includes(type)
          ? selected.filter((t) => t !== type)
          : [...selected, type],
      };
    }),

  setTimeRange: (range) => set({ timeRange: range }),

  getCurrentSnapshot: () => {
    const state = get();
    if (state.history.length === 0) return null;
    if (state.isLive) {
      return state.history[state.history.length - 1];
    }
    return state.history[state.replayIndex] ?? null;
  },

  isViewingLiveRun: () => {
    const state = get();
    return state.viewingRunId === state.currentRunId && state.isLive;
  },
}));
