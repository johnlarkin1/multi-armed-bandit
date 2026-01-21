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
  Cell,
} from 'recharts';
import { useDashboardStore } from '@/stores/dashboardStore';
import { getServerType, getHealthColor, type ServerType } from '@/types/metrics';

interface DataPoint {
  port: string;
  successRate: number;
  numRequests: number;
  serverType: ServerType;
  color: string;
}

export function ServerHealthChart() {
  const history = useDashboardStore((state) => state.history);
  const replayIndex = useDashboardStore((state) => state.replayIndex);
  const isLive = useDashboardStore((state) => state.isLive);
  const selectedServerTypes = useDashboardStore((state) => state.selectedServerTypes);

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
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="port"
            stroke="#94a3b8"
            fontSize={9}
            angle={-45}
            textAnchor="end"
            height={40}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
            }}
            formatter={(value: number | undefined, _name, props) => {
              const payload = props?.payload as DataPoint | undefined;
              const val = value ?? 0;
              if (!payload) return [val, ''];
              return [
                `${val.toFixed(1)}% (${payload.numRequests} reqs)`,
                `Port ${payload.port} (${payload.serverType})`,
              ];
            }}
          />
          <ReferenceLine y={80} stroke="#22C55E" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={50} stroke="#F97316" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Bar dataKey="successRate" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
