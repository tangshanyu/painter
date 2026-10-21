import { TabData } from '../types';
import { createInitialSnapshot } from './history';

// Start a fresh naming sequence only when the workspace has no open documents.
export const getNextDocumentNumber = (tabCount: number, nextNumber: number): number => tabCount === 0 ? 1 : nextNumber;

export function createEmptyDocument(id: string, title: string, width = 800, height = 600, scale = 1): TabData {
  return { id, title: title.trim() || '未命名', imageDataUrl: null, elements: [],
    history: [createInitialSnapshot(null, width, height)], historyIndex: 0,
    canvasWidth: width, canvasHeight: height, scale };
}

export type DocumentCloseAction = 'others' | 'right' | 'all' | 'empty';

export const documentHasContent = (tab: TabData) => Boolean(tab.imageDataUrl) || tab.elements.length > 0;

export function getDocumentCloseIds(tabs: TabData[], anchorId: string, action: DocumentCloseAction): string[] {
  const index = tabs.findIndex(tab => tab.id === anchorId);
  if (index < 0) return [];
  return tabs.filter((tab, position) => action === 'all'
    || (action === 'others' && tab.id !== anchorId)
    || (action === 'right' && position > index)
    || (action === 'empty' && !documentHasContent(tab))).map(tab => tab.id);
}

export function closeDocuments(tabs: TabData[], activeId: string, ids: string[]) {
  const closed = new Set(ids);
  const remaining = tabs.filter(tab => !closed.has(tab.id));
  if (remaining.length === tabs.length) return { tabs, activeId };
  const index = tabs.findIndex(tab => tab.id === activeId);
  const nextActive = !closed.has(activeId) ? activeId
    : tabs.slice(Math.max(0, index + 1)).find(tab => !closed.has(tab.id))?.id
      ?? tabs.slice(0, Math.max(0, index)).reverse().find(tab => !closed.has(tab.id))?.id ?? '';
  return { tabs: remaining, activeId: nextActive };
}

export function closeDocument(tabs: TabData[], activeId: string, id: string) {
  return closeDocuments(tabs, activeId, [id]);
}
