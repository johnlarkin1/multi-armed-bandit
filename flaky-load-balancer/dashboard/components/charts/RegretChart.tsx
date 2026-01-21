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

interface DataPoint {
  time: number;
  regret: number;
}

export function RegretChart() {
  const history = useDashboardStore((state) => state.history);
  const replayIndex = useDashboardStore((state) => state.replayIndex);
  const isLive = useDashboardStore((state) => state.isLive);

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

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full">
      <h3 className="text-sm font-medium text-slate-300 mb-2">Cumulative Regret</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="regretGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="time"
            stroke="#94a3b8"
            fontSize={11}
            tickFormatter={(v) => `${v.toFixed(0)}s`}
          />
          <YAxis stroke="#94a3b8" fontSize={11} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
            }}
            labelFormatter={(v) => `Time: ${Number(v).toFixed(1)}s`}
            formatter={(value: number | undefined) => [value ?? 0, 'Regret']}
          />
          <Area
            type="monotone"
            dataKey="regret"
            stroke="#EF4444"
            strokeWidth={2}
            fill="url(#regretGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
