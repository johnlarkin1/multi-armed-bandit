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

interface DataPoint {
  time: number;
  successRate: number;
  label: string;
}

export function SuccessRateChart() {
  const history = useDashboardStore((state) => state.history);
  const replayIndex = useDashboardStore((state) => state.replayIndex);
  const isLive = useDashboardStore((state) => state.isLive);

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

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full">
      <h3 className="text-sm font-medium text-slate-300 mb-2">Success Rate Over Time</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="time"
            stroke="#94a3b8"
            fontSize={11}
            tickFormatter={(v) => `${v.toFixed(0)}s`}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            domain={[0, 110]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
            }}
            labelFormatter={(v) => `Time: ${Number(v).toFixed(1)}s`}
            formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Success Rate']}
          />
          <ReferenceLine y={100} stroke="#22C55E" strokeDasharray="5 5" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey="successRate"
            stroke="#3B82F6"
            strokeWidth={2}
            fill="url(#successGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
