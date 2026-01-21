'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDashboardStore } from '@/stores/dashboardStore';
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

interface DataPoint {
  time: number;
  regret: number;
}

export function RegretChart() {
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
    return {
      time: elapsed,
      regret: snapshot.global_regret,
    };
  });

  const formatTime = (v: number) => `${v.toFixed(0)}s`;
  const formatTooltipLabel = (v: string | number) => `Time: ${Number(v).toFixed(1)}s`;
  const formatTooltipValue = (value: number | undefined): [number, string] => [value ?? 0, 'Regret'];

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full">
      <h3 className="text-sm font-medium text-slate-300 mb-2">Cumulative Regret</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={CHART_MARGINS.default}>
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
            formatter={formatTooltipValue}
          />
          <Area
            type="monotone"
            dataKey="regret"
            stroke={CHART_COLORS.red}
            strokeWidth={2}
            fill="url(#regretGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
