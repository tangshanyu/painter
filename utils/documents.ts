import { TabData } from '../types';
import { createInitialSnapshot } from './history';

export function createEmptyDocument(id: string, title: string, width = 800, height = 600, scale = 1): TabData {
  return { id, title: title.trim() || '未命名', imageDataUrl: null, elements: [],
    history: [createInitialSnapshot(null, width, height)], historyIndex: 0,
    canvasWidth: width, canvasHeight: height, scale };
}

export function closeDocument(tabs: TabData[], activeId: string, id: string) {
  const index = tabs.findIndex(tab => tab.id === id);
  if (index < 0) return { tabs, activeId };
  const remaining = tabs.filter(tab => tab.id !== id);
  return { tabs: remaining, activeId: activeId === id
    ? remaining[Math.min(index, remaining.length - 1)]?.id ?? '' : activeId };
}
