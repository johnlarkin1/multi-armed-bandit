'use client';

import { AppShell } from '@/components/AppShell';
import { DashboardView } from '@/components/views/DashboardView';

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}
