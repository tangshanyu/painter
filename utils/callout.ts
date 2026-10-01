import { DrawingElement, Point, ToolSettings } from '../types';
import { normalizeToolSize } from './toolSettings';

const rotate = (point: Point, center: Point, angle: number): Point => ({
  x: center.x + (point.x - center.x) * Math.cos(angle) - (point.y - center.y) * Math.sin(angle),
  y: center.y + (point.x - center.x) * Math.sin(angle) + (point.y - center.y) * Math.cos(angle),
});
const centerOf = (element: DrawingElement) => ({ x: (element.x ?? 0) + (element.width ?? 0) / 2, y: (element.y ?? 0) + (element.height ?? 0) / 2 });

export function getCalloutWorldTip(element: DrawingElement): Point | undefined {
  if (!element.calloutTip) return undefined;
  const tip = { x: (element.x ?? 0) + element.calloutTip.x, y: (element.y ?? 0) + element.calloutTip.y };
  return rotate(tip, centerOf(element), element.rotation ?? 0);
}

export function withCalloutWorldTip(element: DrawingElement, tip: Point): DrawingElement {
  const local = rotate(tip, centerOf(element), -(element.rotation ?? 0));
  return { ...element, calloutTip: { x: local.x - (element.x ?? 0), y: local.y - (element.y ?? 0) } };
}

export function createCalloutDraft(start: Point, end: Point, settings: ToolSettings, canvasWidth: number, canvasHeight: number): DrawingElement {
  const fontSize = normalizeToolSize('callout', settings.fontSize);
  const height = Math.ceil(fontSize * 3.2);
  const x = Math.max(0, Math.min(start.x, Math.max(0, canvasWidth - 120)));
  const y = Math.max(0, Math.min(start.y, Math.max(0, canvasHeight - height)));
  return withCalloutWorldTip({
    id: 'temp-callout', type: 'callout', x, y,
    width: Math.max(20, Math.min(280, canvasWidth - x)), height,
    fontSize, strokeWidth: Math.min(4, Math.max(2, fontSize / 8)),
    color: settings.color, opacity: settings.opacity, text: '在這裡輸入文字…',
  }, end);
}

export interface CalloutTailGeometry { base1: Point; base2: Point; tip: Point; side: 'top' | 'bottom' | 'left' | 'right' }

// The endpoint stays exact; only the attachment point moves to the nearest suitable edge.
export function getCalloutTailGeometry(element: DrawingElement): CalloutTailGeometry | null {
  if (!element.calloutTip) return null;
  const rawX = element.x ?? 0, rawY = element.y ?? 0;
  const width = Math.max(20, Math.abs(element.width ?? 0));
  const height = Math.max(normalizeToolSize('callout', element.fontSize) * 1.2, Math.abs(element.height ?? 0));
  const x = rawX + Math.min(0, element.width ?? 0), y = rawY + Math.min(0, element.height ?? 0);
  const tip = { x: rawX + element.calloutTip.x, y: rawY + element.calloutTip.y };
  if (tip.x >= x && tip.x <= x + width && tip.y >= y && tip.y <= y + height) return null;
  const cx = x + width / 2, cy = y + height / 2;
  const dx = tip.x - cx, dy = tip.y - cy;
  const verticalEdge = Math.abs(dx) / width > Math.abs(dy) / height;
  const span = verticalEdge ? height : width;
  const halfBase = Math.min(8, span / 6);
  const margin = Math.min(12, span / 4) + halfBase;
  const clamp = (value: number, from: number) => Math.max(from + margin, Math.min(from + span - margin, value));
  if (verticalEdge) {
    const side = dx < 0 ? 'left' : 'right';
    const edgeX = dx < 0 ? x + 1 : x + width - 1;
    const attachmentY = clamp(cy + dy * (width / 2) / Math.abs(dx), y);
    return { tip, side, base1: { x: edgeX, y: attachmentY - halfBase }, base2: { x: edgeX, y: attachmentY + halfBase } };
  }
  const side = dy < 0 ? 'top' : 'bottom';
  const edgeY = dy < 0 ? y + 1 : y + height - 1;
  const attachmentX = clamp(cx + dx * (height / 2) / Math.abs(dy), x);
  return { tip, side, base1: { x: attachmentX - halfBase, y: edgeY }, base2: { x: attachmentX + halfBase, y: edgeY } };
}

export function isPointInCalloutTail(point: Point, element: DrawingElement): boolean {
  const tail = getCalloutTailGeometry(element);
  if (!tail) return false;
  const { base1: a, base2: b, tip: c } = tail;
  const cross = (p: Point, first: Point, second: Point) => (p.x - second.x) * (first.y - second.y) - (first.x - second.x) * (p.y - second.y);
  const signs = [cross(point, a, b), cross(point, b, c), cross(point, c, a)];
  const inside = !(signs.some(value => value < 0) && signs.some(value => value > 0));
  return inside || Math.hypot(point.x - c.x, point.y - c.y) <= 6;
}
