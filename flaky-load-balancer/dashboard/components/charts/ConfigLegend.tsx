'use client';

import { CONFIG_COLORS, CONFIG_PORT_RANGES, type ServerType } from '@/types/metrics';

interface ConfigLegendProps {
  showPortRanges?: boolean;
}

export function ConfigLegend({ showPortRanges = true }: ConfigLegendProps) {
  const configs: ServerType[] = ['T1', 'T2', 'T3'];

  return (
    <div className="flex gap-4 text-xs">
      {configs.map((config) => (
        <span key={config} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: CONFIG_COLORS[config] }}
          />
          <span className="text-slate-300 font-medium">{config}</span>
          {showPortRanges && (
            <span className="text-slate-500">
              ({CONFIG_PORT_RANGES[config].start}-{CONFIG_PORT_RANGES[config].end})
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
