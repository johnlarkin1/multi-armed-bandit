'use client';

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Radio,
  ChevronFirst,
  ChevronLast,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useReplay } from '@/hooks/useReplay';

export function ReplayControls() {
  // Activate the replay interval logic
  useReplay();

  const {
    history,
    replayIndex,
    isLive,
    isPlaying,
    playbackSpeed,
    goLive,
    setReplayIndex,
    togglePlayback,
    setPlaybackSpeed,
    stepForward,
    stepBackward,
  } = useDashboardStore(
    useShallow((state) => ({
      history: state.history,
      replayIndex: state.replayIndex,
      isLive: state.isLive,
      isPlaying: state.isPlaying,
      playbackSpeed: state.playbackSpeed,
      goLive: state.goLive,
      setReplayIndex: state.setReplayIndex,
      togglePlayback: state.togglePlayback,
      setPlaybackSpeed: state.setPlaybackSpeed,
      stepForward: state.stepForward,
      stepBackward: state.stepBackward,
    }))
  );

  const startTime = history[0]?.timestamp ?? 0;
  const currentTime = history[replayIndex]?.timestamp ?? 0;
  const elapsed = currentTime - startTime;

  const canGoBack = replayIndex > 0;
  const canGoForward = replayIndex < history.length - 1;

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-4">
        {/* Playback controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReplayIndex(0)}
            disabled={history.length === 0}
            className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Go to start"
          >
            <ChevronFirst className="w-4 h-4" />
          </button>

          <button
            onClick={stepBackward}
            disabled={!canGoBack}
            className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Step back"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlayback}
            disabled={history.length === 0 || (isPlaying === false && !canGoForward)}
            className="p-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={stepForward}
            disabled={!canGoForward}
            className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Step forward"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => setReplayIndex(history.length - 1)}
            disabled={history.length === 0}
            className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Go to end"
          >
            <ChevronLast className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline slider */}
        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs text-slate-400 w-16">{elapsed.toFixed(1)}s</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, history.length - 1)}
            value={replayIndex}
            onChange={(e) => setReplayIndex(parseInt(e.target.value, 10))}
            className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            disabled={history.length === 0}
          />
          <span className="text-xs text-slate-400">
            {replayIndex + 1}/{history.length}
          </span>
        </div>

        {/* Playback speed */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Speed:</span>
          {[1, 2, 4].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-2 py-1 text-xs rounded ${
                playbackSpeed === speed
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Go Live button */}
        <button
          onClick={goLive}
          disabled={isLive}
          className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
            isLive
              ? 'bg-green-600/20 text-green-400 cursor-default'
              : 'bg-green-600 text-white hover:bg-green-500'
          }`}
        >
          <Radio className={`w-4 h-4 ${isLive ? 'animate-pulse' : ''}`} />
          {isLive ? 'LIVE' : 'Go Live'}
        </button>
      </div>
    </div>
  );
}
