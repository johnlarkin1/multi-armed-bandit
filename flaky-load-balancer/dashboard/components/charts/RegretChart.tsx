'use client';

import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStore } from '@/stores/dashboardStore';
import { CONFIG_COLORS, type ServerType } from '@/types/metrics';
import { ViewModeToggle, type ViewMode } from '@/components/controls/ViewModeToggle';
import { ConfigLegend } from './ConfigLegend';
import {
  TOOLTIP_CONTENT_STYLE,
  GRID_STROKE,
  GRID_DASH_ARRAY,
  AXIS_STROKE,
  AXIS_FONT_SIZE,
  CHART_COLORS,
  GRADIENT_OPACITY,
  CHART_MARGINS,
} from '@/constants/chartStyles';

interface OverallDataPoint {
  time: number;
  regret: number;
}

interface ConfigDataPoint {
  time: number;
  T1: number;
  T2: number;
  T3: number;
}

export function RegretChart() {
  const [viewMode, setViewMode] = useState<ViewMode>('overall');

  const { history, replayIndex, isLive } = useDashboardStore(
    useShallow((state) => ({
      history: state.history,
      replayIndex: state.replayIndex,
      isLive: state.isLive,
    }))
  );

  // Get data up to current replay point
  const endIndex = isLive ? history.length : replayIndex + 1;
  const visibleHistory = history.slice(0, endIndex);

  const startTime = visibleHistory[0]?.timestamp ?? 0;

  // Overall data for the single area chart view
  const overallData: OverallDataPoint[] = visibleHistory.map((snapshot) => {
    const elapsed = snapshot.timestamp - startTime;
    return {
      time: elapsed,
      regret: snapshot.global_regret,
    };
  });

  // Per-config data for the stacked area chart view
  const configData: ConfigDataPoint[] = visibleHistory.map((snapshot) => {
    const elapsed = snapshot.timestamp - startTime;

    const getConfigRegret = (config: ServerType) => {
      const configMetrics = snapshot.per_config?.[config];
      return configMetrics?.global_regret ?? 0;
    };

    return {
      time: elapsed,
      T1: getConfigRegret('T1'),
      T2: getConfigRegret('T2'),
      T3: getConfigRegret('T3'),
    };
  });

  const formatTime = (v: number) => `${v.toFixed(0)}s`;
  const formatTooltipLabel = (v: string | number) => `Time: ${Number(v).toFixed(1)}s`;

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-300">Cumulative Regret</h3>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      <ResponsiveContainer width="100%" height={200}>
        {viewMode === 'overall' ? (
          <AreaChart data={overallData} margin={CHART_MARGINS.default}>
            <defs>
              <linearGradient id="regretGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.red} stopOpacity={GRADIENT_OPACITY.top} />
                <stop offset="95%" stopColor={CHART_COLORS.red} stopOpacity={GRADIENT_OPACITY.bottom} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
            <XAxis
              dataKey="time"
              stroke={AXIS_STROKE}
              fontSize={AXIS_FONT_SIZE}
              tickFormatter={formatTime}
            />
            <YAxis stroke={AXIS_STROKE} fontSize={AXIS_FONT_SIZE} />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelFormatter={formatTooltipLabel}
              formatter={(value: number | undefined) => [value ?? 0, 'Regret']}
            />
            <Area
              type="monotone"
              dataKey="regret"
              stroke={CHART_COLORS.red}
              strokeWidth={2}
              fill="url(#regretGradient)"
            />
          </AreaChart>
        ) : (
          <AreaChart data={configData} margin={CHART_MARGINS.default}>
            <defs>
              <linearGradient id="regretT1Gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CONFIG_COLORS.T1} stopOpacity={GRADIENT_OPACITY.top} />
                <stop offset="95%" stopColor={CONFIG_COLORS.T1} stopOpacity={GRADIENT_OPACITY.bottom} />
              </linearGradient>
              <linearGradient id="regretT2Gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CONFIG_COLORS.T2} stopOpacity={GRADIENT_OPACITY.top} />
                <stop offset="95%" stopColor={CONFIG_COLORS.T2} stopOpacity={GRADIENT_OPACITY.bottom} />
              </linearGradient>
              <linearGradient id="regretT3Gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CONFIG_COLORS.T3} stopOpacity={GRADIENT_OPACITY.top} />
                <stop offset="95%" stopColor={CONFIG_COLORS.T3} stopOpacity={GRADIENT_OPACITY.bottom} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
            <XAxis
              dataKey="time"
              stroke={AXIS_STROKE}
              fontSize={AXIS_FONT_SIZE}
              tickFormatter={formatTime}
            />
            <YAxis stroke={AXIS_STROKE} fontSize={AXIS_FONT_SIZE} />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelFormatter={formatTooltipLabel}
              formatter={(value: number | undefined, name: string | undefined) => [
                value ?? 0,
                `${name ?? ''} Regret`,
              ]}
            />
            {/* Stacked area chart for config breakdown */}
            <Area
              type="monotone"
              dataKey="T1"
              stackId="1"
              stroke={CONFIG_COLORS.T1}
              strokeWidth={1}
              fill="url(#regretT1Gradient)"
            />
            <Area
              type="monotone"
              dataKey="T2"
              stackId="1"
              stroke={CONFIG_COLORS.T2}
              strokeWidth={1}
              fill="url(#regretT2Gradient)"
            />
            <Area
              type="monotone"
              dataKey="T3"
              stackId="1"
              stroke={CONFIG_COLORS.T3}
              strokeWidth={1}
              fill="url(#regretT3Gradient)"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>

      {/* Show config legend when in byConfig mode */}
      {viewMode === 'byConfig' && (
        <div className="mt-2 flex justify-center">
          <ConfigLegend showPortRanges={false} />
        </div>
      )}
    </div>
  );
}
