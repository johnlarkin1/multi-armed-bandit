'use client';

import { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';

export function useReplay() {
  const intervalRef = useRef<number | null>(null);
  const isPlaying = useDashboardStore((state) => state.isPlaying);
  const playbackSpeed = useDashboardStore((state) => state.playbackSpeed);
  const historyLength = useDashboardStore((state) => state.history.length);
  const replayIndex = useDashboardStore((state) => state.replayIndex);
  const stepForward = useDashboardStore((state) => state.stepForward);

  useEffect(() => {
    if (isPlaying && replayIndex < historyLength - 1) {
      const baseInterval = 500; // matches SSE interval
      const interval = baseInterval / playbackSpeed;

      intervalRef.current = window.setInterval(() => {
        const state = useDashboardStore.getState();
        if (state.replayIndex >= state.history.length - 1) {
          // Reached end, stop playback
          useDashboardStore.setState({ isPlaying: false });
        } else {
          stepForward();
        }
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, historyLength, replayIndex, stepForward]);
}
