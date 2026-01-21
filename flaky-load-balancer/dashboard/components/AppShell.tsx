'use client';

import { useMetricsSSE } from '@/hooks/useMetricsSSE';
import { Header } from '@/components/Header';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { refreshHistory, loadRun } = useMetricsSSE();

  return (
    <>
      <Header onRefresh={refreshHistory} onSelectRun={loadRun} />
      {children}
    </>
  );
}
