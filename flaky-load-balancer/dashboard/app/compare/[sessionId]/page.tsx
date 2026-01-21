'use client';

import { use } from 'react';
import { AppShell } from '@/components/AppShell';
import { CompareView } from '@/components/views/CompareView';

interface SessionComparePageProps {
  params: Promise<{ sessionId: string }>;
}

export default function SessionComparePage({ params }: SessionComparePageProps) {
  const { sessionId } = use(params);

  return (
    <AppShell>
      <CompareView sessionId={sessionId} />
    </AppShell>
  );
}
