'use client';

import { useRef } from 'react';
import { StatsPanel } from '@/components/StatsPanel';
import { ExportButton } from '@/components/ExportButton';
import { SuccessRateChart } from '@/components/charts/SuccessRateChart';
import { RegretChart } from '@/components/charts/RegretChart';
import { ServerHealthChart } from '@/components/charts/ServerHealthChart';
import { LatencyHistogram } from '@/components/charts/LatencyHistogram';
import { ReplayControls } from '@/components/controls/ReplayControls';
import { FilterSidebar } from '@/components/controls/FilterSidebar';

interface DashboardViewProps {
  dashboardRef?: React.RefObject<HTMLDivElement>;
}

export function DashboardView({ dashboardRef }: DashboardViewProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = dashboardRef || localRef;

  return (
    <main className="p-6 space-y-6">
      {/* Top bar with stats and export */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <StatsPanel />
        </div>
        <ExportButton dashboardRef={ref} />
      </div>

      {/* Main dashboard content - referenced for export */}
      <div ref={ref} className="space-y-6 bg-slate-900 p-1">
        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SuccessRateChart />
          <RegretChart />
          <ServerHealthChart />
          <LatencyHistogram />
        </div>
      </div>

      {/* Filter controls */}
      <FilterSidebar />

      {/* Replay controls at bottom */}
      <ReplayControls />
    </main>
  );
}
