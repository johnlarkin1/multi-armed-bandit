'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useDashboardStore } from '@/stores/dashboardStore';
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

interface DataPoint {
  time: number;
  successRate: number;
  label: string;
}

export function SuccessRateChart() {
  const { history, replayIndex, isLive } = useDashboardStore((state) => ({
    history: state.history,
    replayIndex: state.replayIndex,
    isLive: state.isLive,
  }));

  // Get data up to current replay point
  const endIndex = isLive ? history.length : replayIndex + 1;
  const visibleHistory = history.slice(0, endIndex);

  const startTime = visibleHistory[0]?.timestamp ?? 0;

  const data: DataPoint[] = visibleHistory.map((snapshot) => {
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

  const formatTime = (v: number) => `${v.toFixed(0)}s`;
  const formatPercent = (v: number) => `${v}%`;
  const formatTooltipLabel = (v: string | number) => `Time: ${Number(v).toFixed(1)}s`;
  const formatTooltipValue = (value: number | undefined): [string, string] => [
    `${(value ?? 0).toFixed(1)}%`,
    'Success Rate',
  ];

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full">
      <h3 className="text-sm font-medium text-slate-300 mb-2">Success Rate Over Time</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={CHART_MARGINS.default}>
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
            formatter={formatTooltipValue}
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
      </ResponsiveContainer>
    </div>
  );
}
