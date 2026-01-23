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
  ReferenceArea,
  Cell,
} from 'recharts';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStore } from '@/stores/dashboardStore';
import { getServerType, getHealthColor, CONFIG_COLORS, type ServerType } from '@/types/metrics';
import { ConfigLegend } from './ConfigLegend';
import {
  TOOLTIP_CONTENT_STYLE,
  GRID_STROKE,
  GRID_DASH_ARRAY,
  AXIS_STROKE,
  AXIS_FONT_SIZE,
  AXIS_FONT_SIZE_SMALL,
  CHART_COLORS,
  REFERENCE_LINE_OPACITY,
  CHART_MARGINS,
  withOpacity,
} from '@/constants/chartStyles';

interface DataPoint {
  port: string;
  successRate: number;
  numRequests: number;
  serverType: ServerType;
  color: string;
}

export function ServerHealthChart() {
  const { history, replayIndex, isLive, selectedServerTypes } = useDashboardStore(
    useShallow((state) => ({
      history: state.history,
      replayIndex: state.replayIndex,
      isLive: state.isLive,
      selectedServerTypes: state.selectedServerTypes,
    }))
  );

  // Get current snapshot based on live/replay state
  const snapshot = history.length === 0
    ? null
    : isLive
      ? history[history.length - 1]
      : history[replayIndex] ?? null;

  if (!snapshot || Object.keys(snapshot.per_server).length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-slate-400 text-sm">Waiting for server data...</p>
      </div>
    );
  }

  const data: DataPoint[] = Object.entries(snapshot.per_server)
    .map(([port, metrics]) => {
      const portNum = parseInt(port, 10);
      const serverType = getServerType(portNum);
      return {
        port,
        successRate: metrics.success_rate * 100,
        numRequests: metrics.num_requests,
        serverType,
        color: getHealthColor(metrics.success_rate),
      };
    })
    .filter((d) => selectedServerTypes.includes(d.serverType))
    .sort((a, b) => parseInt(a.port, 10) - parseInt(b.port, 10));

  // Compute port ranges for each config type for ReferenceArea backgrounds
  const configRanges: { config: ServerType; firstPort: string; lastPort: string }[] = [];
  let currentConfig: ServerType | null = null;
  let firstPort: string | null = null;
  let lastPort: string | null = null;

  for (const point of data) {
    if (point.serverType !== currentConfig) {
      if (currentConfig !== null && firstPort !== null && lastPort !== null) {
        configRanges.push({ config: currentConfig, firstPort, lastPort });
      }
      currentConfig = point.serverType;
      firstPort = point.port;
      lastPort = point.port;
    } else {
      lastPort = point.port;
    }
  }
  if (currentConfig !== null && firstPort !== null && lastPort !== null) {
    configRanges.push({ config: currentConfig, firstPort, lastPort });
  }

  const formatPercent = (v: number) => `${v}%`;
  const formatTooltipValue = (
    value: number | undefined,
    _name: string | undefined,
    props: { payload?: DataPoint } | undefined
  ): [string, string] => {
    const payload = props?.payload;
    const val = value ?? 0;
    if (!payload) return [`${val}`, ''];
    return [
      `${val.toFixed(1)}% (${payload.numRequests} reqs)`,
      `Port ${payload.port} (${payload.serverType})`,
    ];
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-300">Per-Server Success Rate</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            &gt;80%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            50-80%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            &lt;50%
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={CHART_MARGINS.withLabels}>
          <CartesianGrid strokeDasharray={GRID_DASH_ARRAY} stroke={GRID_STROKE} />
          {/* Config type background shading */}
          {configRanges.map((range) => (
            <ReferenceArea
              key={range.config}
              x1={range.firstPort}
              x2={range.lastPort}
              fill={withOpacity(CONFIG_COLORS[range.config], 'ultraLight')}
              strokeOpacity={0}
            />
          ))}
          <XAxis
            dataKey="port"
            stroke={AXIS_STROKE}
            fontSize={AXIS_FONT_SIZE_SMALL}
            angle={-45}
            textAnchor="end"
            height={40}
          />
          <YAxis
            stroke={AXIS_STROKE}
            fontSize={AXIS_FONT_SIZE}
            domain={[0, 100]}
            tickFormatter={formatPercent}
          />
          <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} formatter={formatTooltipValue} />
          <ReferenceLine
            y={80}
            stroke={CHART_COLORS.green}
            strokeDasharray={GRID_DASH_ARRAY}
            strokeOpacity={REFERENCE_LINE_OPACITY}
          />
          <ReferenceLine
            y={50}
            stroke={CHART_COLORS.orange}
            strokeDasharray={GRID_DASH_ARRAY}
            strokeOpacity={REFERENCE_LINE_OPACITY}
          />
          <Bar dataKey="successRate" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Config type legend */}
      <div className="mt-2 flex justify-center">
        <ConfigLegend showPortRanges={true} />
      </div>
    </div>
  );
}
