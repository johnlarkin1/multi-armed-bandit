'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
}

export function Tooltip({ content }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="text-slate-500 hover:text-slate-300 transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="More information"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isVisible && (
        <div className="absolute top-full right-1/2 translate-x-1/2 mt-2 z-50">
          {/* Arrow */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px">
            <div className="border-4 border-transparent border-b-slate-900" />
          </div>
          <div className="bg-slate-900 text-slate-200 text-xs px-3 py-2 rounded-md shadow-lg max-w-[128px] w-max text-center border border-slate-700">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
