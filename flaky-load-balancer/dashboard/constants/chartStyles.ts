import type { CSSProperties } from 'react';

/**
 * Shared chart styling constants for Recharts components.
 * Extracts duplicate tooltip, grid, and axis styling into reusable constants.
 */

// Tooltip styling shared across all charts
export const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '6px',
};

// Tooltip item text style for dark mode readability
export const TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: '#e2e8f0', // slate-200 for readability
};

// CartesianGrid styling
export const GRID_STROKE = '#334155';
export const GRID_DASH_ARRAY = '3 3';

// Axis styling
export const AXIS_STROKE = '#94a3b8';
export const AXIS_FONT_SIZE = 11;
export const AXIS_FONT_SIZE_SMALL = 9;

// Chart colors
export const CHART_COLORS = {
  blue: '#3B82F6',
  red: '#EF4444',
  green: '#22C55E',
  orange: '#F97316',
  purple: '#8B5CF6',
  lightBlue: '#60A5FA',
  lightRed: '#F87171',
} as const;

// Reference line styling
export const REFERENCE_LINE_OPACITY = 0.5;
export const REFERENCE_LINE_DASH_ARRAY = '5 5';

// Gradient opacity values for area fills
export const GRADIENT_OPACITY = {
  top: 0.3,
  bottom: 0,
} as const;

// Color with opacity helper - converts hex color to rgba or hex with alpha
export const COLOR_OPACITY = {
  ultraLight: '15', // ~8% opacity for subtle backgrounds
  light: '30', // ~19% opacity for backgrounds
  medium: '50', // ~31% opacity
  heavy: '80', // ~50% opacity
} as const;

/**
 * Creates a color with appended hex opacity.
 * @example withOpacity('#3B82F6', 'light') => '#3B82F630'
 */
export function withOpacity(hexColor: string, opacity: keyof typeof COLOR_OPACITY): string {
  return `${hexColor}${COLOR_OPACITY[opacity]}`;
}

// Chart container default styles
export const CHART_CONTAINER_CLASS = 'bg-slate-800 rounded-lg p-4 h-full';
export const CHART_TITLE_CLASS = 'text-sm font-medium text-slate-300 mb-2';

// Common chart margins
export const CHART_MARGINS = {
  default: { top: 10, right: 10, left: 0, bottom: 0 },
  withLabels: { top: 10, right: 10, left: 0, bottom: 20 },
} as const;
