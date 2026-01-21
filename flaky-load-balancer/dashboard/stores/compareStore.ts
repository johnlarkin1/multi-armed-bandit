import { create } from 'zustand';
import type { SessionInfo, RunSummary } from '@/types/metrics';

interface CompareState {
  sessions: SessionInfo[];
  selectedSessionId: string | null;
  comparisonData: RunSummary[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setSessions: (sessions: SessionInfo[]) => void;
  selectSession: (sessionId: string | null) => void;
  setComparisonData: (data: RunSummary[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useCompareStore = create<CompareState>((set) => ({
  sessions: [],
  selectedSessionId: null,
  comparisonData: [],
  isLoading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),
  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
  setComparisonData: (data) => set({ comparisonData: data }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set({
    sessions: [],
    selectedSessionId: null,
    comparisonData: [],
    isLoading: false,
    error: null,
  }),
}));
