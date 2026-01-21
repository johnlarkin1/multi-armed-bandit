'use client';

import { useDashboardStore } from '@/stores/dashboardStore';
import type { ServerType } from '@/types/metrics';

const SERVER_TYPES: { type: ServerType; label: string; ports: string }[] = [
  { type: 'T1', label: 'Tier 1', ports: '4000-4009' },
  { type: 'T2', label: 'Tier 2', ports: '5000-5009' },
  { type: 'T3', label: 'Tier 3', ports: '6000-6009' },
];

export function FilterSidebar() {
  const selectedServerTypes = useDashboardStore((state) => state.selectedServerTypes);
  const toggleServerType = useDashboardStore((state) => state.toggleServerType);

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Server Types</h3>
      <div className="flex flex-wrap gap-2">
        {SERVER_TYPES.map(({ type, ports }) => {
          const isSelected = selectedServerTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => toggleServerType(type)}
              className={`px-3 py-2 rounded text-sm transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title={`Ports ${ports}`}
            >
              <span className="font-medium">{type}</span>
              <span className="text-xs ml-1 opacity-70">({ports})</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Filter which server tiers to show in the health chart
      </p>
    </div>
  );
}
