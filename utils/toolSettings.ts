import { DEFAULT_TOOL_SETTINGS, DEFAULT_TOOL_SIZES } from '../constants';
import { DrawingElement, ToolSettings, ToolType } from '../types';

export const isFontTool = (tool: string) => tool === 'text' || tool === 'callout';
export const getMinimumToolSize = (tool: string) => isFontTool(tool) ? 8 : tool === 'stamp' || tool === 'symbol' ? 16 : tool === 'pixelate' ? 2 : 1;

export function normalizeToolSize(tool: string, size: number | undefined): number {
  const fallback = DEFAULT_TOOL_SIZES[tool as ToolType] ?? 4;
  return Math.max(getMinimumToolSize(tool), Number.isFinite(size) ? size! : fallback);
}

export function getToolSize(tool: ToolType, settings: ToolSettings): number {
  return normalizeToolSize(tool, settings.toolSizes[tool] ?? DEFAULT_TOOL_SIZES[tool]);
}

// Older documents encoded stamp radius through line width. New documents store a diameter.
export function getStampDiameter(element: DrawingElement): number {
  return normalizeToolSize('stamp', element.stampSize ?? (10 + element.strokeWidth) * 2);
}

export function getElementSize(element: DrawingElement): number {
  if (element.type === 'stamp') return getStampDiameter(element);
  if (element.type === 'highlighter') return normalizeToolSize('highlighter', element.highlighterWidth ?? element.strokeWidth * 3);
  return normalizeToolSize(element.type, isFontTool(element.type)
    ? element.fontSize ?? element.strokeWidth * 6 : element.strokeWidth);
}

export function getCreationSettings(tool: ToolType, settings: ToolSettings): ToolSettings {
  if (DEFAULT_TOOL_SIZES[tool] === undefined) return settings;
  const size = getToolSize(tool, settings);
  return isFontTool(tool) ? { ...settings, fontSize: size } : { ...settings, strokeWidth: size };
}

export function rememberToolSettings(tool: ToolType, settings: ToolSettings): ToolSettings {
  if (DEFAULT_TOOL_SIZES[tool] === undefined) return settings;
  const size = normalizeToolSize(tool, isFontTool(tool) ? settings.fontSize : settings.strokeWidth);
  return getCreationSettings(tool, { ...settings, toolSizes: { ...settings.toolSizes, [tool]: size } });
}

export function restoreToolSettings(saved: Partial<ToolSettings>): ToolSettings {
  const sizes = { ...DEFAULT_TOOL_SIZES, ...saved.toolSizes };
  // Legacy presets were 2/4/8/12. Modern diameters start at 16 and never need conversion.
  if (sizes.stamp !== undefined && sizes.stamp < 16) sizes.stamp = (10 + sizes.stamp) * 2;
  for (const tool of Object.keys(DEFAULT_TOOL_SIZES) as ToolType[]) sizes[tool] = normalizeToolSize(tool, sizes[tool]);
  return { ...DEFAULT_TOOL_SETTINGS, ...saved, toolSizes: sizes };
}

export function getSettingsForElement(element: DrawingElement, settings: ToolSettings): ToolSettings {
  const size = getElementSize(element);
  return {
    ...settings,
    color: element.color,
    opacity: element.opacity ?? 1,
    strokeWidth: isFontTool(element.type) ? element.strokeWidth : size,
    fontSize: isFontTool(element.type) ? size : settings.fontSize,
    arrowStyle: element.arrowStyle ?? settings.arrowStyle,
    stampStyle: element.stampStyle ?? settings.stampStyle,
    symbol: element.symbol ?? settings.symbol,
    pixelateStyle: element.pixelateStyle ?? settings.pixelateStyle,
    highlighterStyle: element.highlighterStyle ?? settings.highlighterStyle,
  };
}

export function applyElementStyle(element: DrawingElement, values: Partial<DrawingElement>): DrawingElement {
  if (element.locked) return element;
  const updated = { ...element, ...values };
  if (isFontTool(element.type) && values.fontSize !== undefined) {
    updated.fontSize = normalizeToolSize(element.type, values.fontSize);
    updated.strokeWidth = element.type === 'callout'
      ? Math.min(4, Math.max(2, updated.fontSize / 8)) : Math.max(1, updated.fontSize / 6);
  } else if (values.strokeWidth !== undefined || values.stampSize !== undefined) {
    updated.strokeWidth = normalizeToolSize(element.type, values.stampSize ?? values.strokeWidth);
    if (element.type === 'stamp') updated.stampSize = updated.strokeWidth;
    if (element.type === 'highlighter') updated.highlighterWidth = updated.strokeWidth;
  }
  return updated;
}

export function applyToolSettingsToElement(element: DrawingElement, settings: ToolSettings): DrawingElement {
  return applyElementStyle(element, {
    color: settings.color,
    opacity: settings.opacity,
    ...(isFontTool(element.type) ? { fontSize: settings.fontSize } : { strokeWidth: settings.strokeWidth }),
    ...(element.type === 'arrow' ? { arrowStyle: settings.arrowStyle } : {}),
    ...(element.type === 'stamp' ? { stampStyle: settings.stampStyle } : {}),
    ...(element.type === 'symbol' ? { symbol: settings.symbol } : {}),
    ...(element.type === 'pixelate' ? { pixelateStyle: settings.pixelateStyle } : {}),
    ...(element.type === 'highlighter' ? { highlighterStyle: settings.highlighterStyle } : {}),
  });
}
