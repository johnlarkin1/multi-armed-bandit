'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Wifi, WifiOff, RefreshCw, Database, Zap, BarChart3, LayoutDashboard } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { RunSelector } from '@/components/controls/RunSelector';
import { STRATEGY_NAMES, STRATEGY_COLORS, type Strategy } from '@/types/metrics';

interface HeaderProps {
  onRefresh?: () => Promise<boolean>;
  onSelectRun?: (runId: string) => void;
}

export function Header({ onRefresh, onSelectRun }: HeaderProps) {
  const pathname = usePathname();
  const isConnected = useDashboardStore((state) => state.isConnected);
  const currentStrategy = useDashboardStore((state) => state.currentStrategy);
  const isLive = useDashboardStore((state) => state.isLive);
  const hasHistoricalData = useDashboardStore((state) => state.hasHistoricalData);
  const historyLength = useDashboardStore((state) => state.history.length);
  const liveRunDetected = useDashboardStore((state) => state.liveRunDetected);
  const joinLiveRun = useDashboardStore((state) => state.joinLiveRun);
  const viewingRunId = useDashboardStore((state) => state.viewingRunId);
  const currentRunId = useDashboardStore((state) => state.currentRunId);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const isOnDashboard = pathname === '/';
  const isOnCompare = pathname.startsWith('/compare');

  const strategyName = currentStrategy ? STRATEGY_NAMES[currentStrategy] : 'Unknown';
  const strategyColor = currentStrategy ? STRATEGY_COLORS[currentStrategy as Strategy] : '#64748b';

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleJoinLive = () => {
    joinLiveRun();
    // Trigger a refresh to load the live run's data
    if (onRefresh) {
      onRefresh();
    }
  };

  // Determine connection status display
  const getConnectionStatus = () => {
    if (isConnected && viewingRunId === currentRunId) {
      return {
        icon: <Wifi className="w-4 h-4 text-green-400" />,
        text: 'Live',
        textClass: 'text-green-400',
      };
    }
    if (isConnected && viewingRunId !== currentRunId) {
      return {
        icon: <Database className="w-4 h-4 text-blue-400" />,
        text: 'Viewing History',
        textClass: 'text-blue-400',
      };
    }
    if (hasHistoricalData) {
      return {
        icon: <Database className="w-4 h-4 text-blue-400" />,
        text: 'Offline - Historical Data',
        textClass: 'text-blue-400',
      };
    }
    return {
      icon: <WifiOff className="w-4 h-4 text-red-400" />,
      text: 'Disconnected',
      textClass: 'text-red-400',
    };
  };

  const connectionStatus = getConnectionStatus();
  const isViewingHistory = viewingRunId && viewingRunId !== currentRunId;

  return (
    <header className="bg-slate-800 border-b border-slate-700">
      {/* Live run notification banner */}
      {liveRunDetected && (
        <div className="bg-green-500/10 border-b border-green-500/30 px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-400">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">
                New simulation started! A live run is in progress.
              </span>
            </div>
            <button
              onClick={handleJoinLive}
              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded transition-colors"
            >
              Join Live
            </button>
          </div>
        </div>
      )}

      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-400" />
              <h1 className="text-xl font-semibold text-white">Flaky Load Balancer</h1>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isOnDashboard
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                href="/compare"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isOnCompare
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Compare
              </Link>
            </nav>

            {currentStrategy && isOnDashboard && (
              <div
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{ backgroundColor: `${strategyColor}20`, color: strategyColor }}
              >
                {currentStrategy.toUpperCase()}: {strategyName}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Run selector (dashboard only) */}
            {isOnDashboard && onSelectRun && <RunSelector onSelectRun={onSelectRun} />}

            {/* Replay mode badge (dashboard only) */}
            {isOnDashboard && !isLive && historyLength > 0 && (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                REPLAY MODE
              </span>
            )}

            {/* Viewing history badge (dashboard only) */}
            {isOnDashboard && isViewingHistory && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                HISTORICAL
              </span>
            )}

            {/* Refresh button (dashboard only) */}
            {isOnDashboard && onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 text-slate-300 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Connection status (dashboard only) */}
            {isOnDashboard && (
              <div className="flex items-center gap-2">
                {connectionStatus.icon}
                <span className={`text-sm ${connectionStatus.textClass}`}>
                  {connectionStatus.text}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
