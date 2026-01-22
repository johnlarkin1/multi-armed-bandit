'use client';

export type ViewMode = 'overall' | 'byConfig';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex rounded-md bg-slate-700 p-0.5">
      <button
        onClick={() => onChange('overall')}
        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
          value === 'overall'
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:text-white'
        }`}
      >
        Overall
      </button>
      <button
        onClick={() => onChange('byConfig')}
        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
          value === 'byConfig'
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:text-white'
        }`}
      >
        By Config
      </button>
    </div>
  );
}
