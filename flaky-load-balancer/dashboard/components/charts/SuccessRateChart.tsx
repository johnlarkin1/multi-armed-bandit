'use client';

import { useState } from 'react';
import {
  AreaChart,
  LineChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
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
  REFERENCE_LINE_DASH_ARRAY,
  REFERENCE_LINE_OPACITY,
  GRADIENT_OPACITY,
  CHART_MARGINS,
} from '@/constants/chartStyles';

interface OverallDataPoint {
  time: number;
  successRate: number;
  label: string;
}

interface ConfigDataPoint {
  time: number;
  overall: number;
  T1: number;
  T2: number;
  T3: number;
}

export function SuccessRateChart() {
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
    const successRate =
      snapshot.total_requests > 0
        ? (snapshot.total_success / snapshot.total_requests) * 100
        : 0;
    return {
      time: elapsed,
      successRate: Math.round(successRate * 10) / 10,
      label: `${elapsed.toFixed(1)}s`,
    };
  });

  // Per-config data for the multi-line chart view
  const configData: ConfigDataPoint[] = visibleHistory.map((snapshot) => {
    const elapsed = snapshot.timestamp - startTime;
    const overallRate =
      snapshot.total_requests > 0
        ? (snapshot.total_success / snapshot.total_requests) * 100
        : 0;

    const getConfigRate = (config: ServerType) => {
      const configMetrics = snapshot.per_config?.[config];
      if (!configMetrics || configMetrics.total_requests === 0) return 0;
      return (configMetrics.total_success / configMetrics.total_requests) * 100;
    };

    return {
      time: elapsed,
      overall: Math.round(overallRate * 10) / 10,
      T1: Math.round(getConfigRate('T1') * 10) / 10,
      T2: Math.round(getConfigRate('T2') * 10) / 10,
      T3: Math.round(getConfigRate('T3') * 10) / 10,
    };
  });

  const formatTime = (v: number) => `${v.toFixed(0)}s`;
  const formatPercent = (v: number) => `${v}%`;
  const formatTooltipLabel = (v: string | number) => `Time: ${Number(v).toFixed(1)}s`;

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-300">Success Rate Over Time</h3>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      <ResponsiveContainer width="100%" height={200}>
        {viewMode === 'overall' ? (
          <AreaChart data={overallData} margin={CHART_MARGINS.default}>
            <defs>
              <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={GRADIENT_OPACITY.top} />
                <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={GRADIENT_OPACITY.bottom} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
            <XAxis
              dataKey="time"
              stroke={AXIS_STROKE}
              fontSize={AXIS_FONT_SIZE}
              tickFormatter={formatTime}
            />
            <YAxis
              stroke={AXIS_STROKE}
              fontSize={AXIS_FONT_SIZE}
              domain={[0, 110]}
              tickFormatter={formatPercent}
            />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelFormatter={formatTooltipLabel}
              formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Success Rate']}
            />
            <ReferenceLine
              y={100}
              stroke={CHART_COLORS.green}
              strokeDasharray={REFERENCE_LINE_DASH_ARRAY}
              strokeOpacity={REFERENCE_LINE_OPACITY}
            />
            <Area
              type="monotone"
              dataKey="successRate"
              stroke={CHART_COLORS.blue}
              strokeWidth={2}
              fill="url(#successGradient)"
            />
          </AreaChart>
        ) : (
          <LineChart data={configData} margin={CHART_MARGINS.default}>
            <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
            <XAxis
              dataKey="time"
              stroke={AXIS_STROKE}
              fontSize={AXIS_FONT_SIZE}
              tickFormatter={formatTime}
            />
            <YAxis
              stroke={AXIS_STROKE}
              fontSize={AXIS_FONT_SIZE}
              domain={[0, 110]}
              tickFormatter={formatPercent}
            />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelFormatter={formatTooltipLabel}
              formatter={(value: number | undefined, name: string | undefined) => [
                `${(value ?? 0).toFixed(1)}%`,
                name === 'overall' ? 'Overall' : (name ?? ''),
              ]}
            />
            <ReferenceLine
              y={100}
              stroke={CHART_COLORS.green}
              strokeDasharray={REFERENCE_LINE_DASH_ARRAY}
              strokeOpacity={REFERENCE_LINE_OPACITY}
            />
            {/* Overall line - dashed */}
            <Line
              type="monotone"
              dataKey="overall"
              stroke={AXIS_STROKE}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
            {/* Config lines - solid */}
            <Line
              type="monotone"
              dataKey="T1"
              stroke={CONFIG_COLORS.T1}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="T2"
              stroke={CONFIG_COLORS.T2}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="T3"
              stroke={CONFIG_COLORS.T3}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>

      {/* Show config legend when in byConfig mode */}
      {viewMode === 'byConfig' && (
        <div className="mt-2 flex items-center justify-center gap-4">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-4 h-0.5 bg-slate-400" style={{ borderTop: '2px dashed' }} />
            <span className="text-slate-400">Overall</span>
          </span>
          <ConfigLegend showPortRanges={false} />
        </div>
      )}
    </div>
  );
}
