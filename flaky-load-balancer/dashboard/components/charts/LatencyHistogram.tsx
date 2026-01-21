'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStore } from '@/stores/dashboardStore';
import {
  TOOLTIP_CONTENT_STYLE,
  GRID_STROKE,
  GRID_DASH_ARRAY,
  AXIS_STROKE,
  AXIS_FONT_SIZE,
  AXIS_FONT_SIZE_SMALL,
  CHART_COLORS,
  REFERENCE_LINE_DASH_ARRAY,
  CHART_MARGINS,
} from '@/constants/chartStyles';

interface HistogramBin {
  range: string;
  count: number;
  min: number;
  max: number;
}

function createHistogramBins(latencies: number[], numBins: number = 20): HistogramBin[] {
  if (latencies.length === 0) return [];

  const min = Math.min(...latencies);
  const max = Math.max(...latencies);

  // Handle case where all values are the same
  if (min === max) {
    return [
      {
        range: `${min.toFixed(0)}`,
        count: latencies.length,
        min,
        max,
      },
    ];
  }

  const binWidth = (max - min) / numBins;
  const bins: HistogramBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const binMin = min + i * binWidth;
    const binMax = min + (i + 1) * binWidth;
    const count = latencies.filter((v) => v >= binMin && (i === numBins - 1 ? v <= binMax : v < binMax)).length;

    bins.push({
      range: `${binMin.toFixed(0)}-${binMax.toFixed(0)}`,
      count,
      min: binMin,
      max: binMax,
    });
  }

  return bins;
}

export function LatencyHistogram() {
  const { history, replayIndex, isLive } = useDashboardStore(
    useShallow((state) => ({
      history: state.history,
      replayIndex: state.replayIndex,
      isLive: state.isLive,
    }))
  );

  // Get current snapshot based on live/replay state
  const snapshot = history.length === 0
    ? null
    : isLive
      ? history[history.length - 1]
      : history[replayIndex] ?? null;

  if (!snapshot || snapshot.latencies.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-slate-400 text-sm">Waiting for latency data...</p>
      </div>
    );
  }

  const bins = createHistogramBins(snapshot.latencies, 15);
  const p50 = snapshot.latency_p50;
  const p99 = snapshot.latency_p99;

  const formatTooltipValue = (value: number | undefined): [number, string] => [value ?? 0, 'Count'];
  const formatTooltipLabel = (label: string) => `Latency: ${label}ms`;

  const p50Bin = bins.find((b) => p50 >= b.min && p50 <= b.max)?.range;
  const p99Bin = bins.find((b) => p99 >= b.min && p99 <= b.max)?.range;

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-300">Latency Distribution</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-400"></span>
            P50: {p50.toFixed(0)}ms
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-red-400"></span>
            P99: {p99.toFixed(0)}ms
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={bins} margin={CHART_MARGINS.withLabels}>
          <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
          <XAxis
            dataKey="range"
            stroke={AXIS_STROKE}
            fontSize={AXIS_FONT_SIZE_SMALL}
            angle={-45}
            textAnchor="end"
            height={40}
            interval={2}
          />
          <YAxis stroke={AXIS_STROKE} fontSize={AXIS_FONT_SIZE} />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            formatter={formatTooltipValue}
            labelFormatter={formatTooltipLabel}
          />
          <ReferenceLine
            x={p50Bin}
            stroke={CHART_COLORS.lightBlue}
            strokeDasharray={REFERENCE_LINE_DASH_ARRAY}
            label={{ value: 'P50', position: 'top', fill: CHART_COLORS.lightBlue, fontSize: 10 }}
          />
          <ReferenceLine
            x={p99Bin}
            stroke={CHART_COLORS.lightRed}
            strokeDasharray={REFERENCE_LINE_DASH_ARRAY}
            label={{ value: 'P99', position: 'top', fill: CHART_COLORS.lightRed, fontSize: 10 }}
          />
          <Bar dataKey="count" fill={CHART_COLORS.purple} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
