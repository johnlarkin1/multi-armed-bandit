'use client';

import { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';

export function useReplay() {
  const intervalRef = useRef<number | null>(null);

  const { isPlaying, playbackSpeed, historyLength, replayIndex, stepForward } = useDashboardStore(
    (state) => ({
      isPlaying: state.isPlaying,
      playbackSpeed: state.playbackSpeed,
      historyLength: state.history.length,
      replayIndex: state.replayIndex,
      stepForward: state.stepForward,
    })
  );

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
