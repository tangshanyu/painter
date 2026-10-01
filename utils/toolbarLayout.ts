import { ToolType } from '../types';

// Width comes from the toolbar itself, so window zoom and either appearance use the same rules.
export function getToolbarLayout(width: number) {
  const direct: ToolType[] = width >= 1050
    ? ['select', 'hand', 'crop', 'eraser', 'arrow', 'stamp', 'text', 'callout', 'spotlight']
    : width >= 800 ? ['select', 'hand', 'arrow', 'stamp', 'text', 'callout']
    : width >= 600 ? ['select', 'hand', 'arrow', 'text'] : ['select', 'text'];
  return { direct, shapes: width >= 800, symbols: width >= 600, quickSettings: width >= 420,
    history: width >= 600, capture: width >= 800, copy: width >= 800,
    labels: width >= 1200 };
}
