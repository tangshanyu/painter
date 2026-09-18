
import { ToolSettings, ToolSizeMap } from './types';

export const DEFAULT_TOOL_SIZES: ToolSizeMap = {
  pen: 4,
  highlighter: 4,
  rect: 4,
  circle: 4,
  triangle: 4,
  diamond: 4,
  line: 4,
  arrow: 4,
  text: 24,
  callout: 18,
  stamp: 32,
  symbol: 48,
  pixelate: 12,
};

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  color: '#ef4444', // Red default
  strokeWidth: 4,
  fontSize: 24,
  toolSizes: { ...DEFAULT_TOOL_SIZES },
  opacity: 1,
  arrowStyle: 'filled',
  stampStyle: 'circle',
  symbol: '✓',
  pixelateStyle: 'pixel',
  highlighterStyle: 'brush',
};

export const HIGHLIGHTER_OPACITY = 0.4;

export const COLORS = [
  '#000000', // Black
  '#ffffff', // White
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#a855f7', // Purple
];

export const STROKE_WIDTHS = [2, 4, 6, 8, 12, 24];
