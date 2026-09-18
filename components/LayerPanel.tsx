import React, { useState } from 'react';
import { ChevronsLeft, ChevronsRight, Copy, Eye, EyeOff, GripVertical, Lock, Trash2, Unlock } from 'lucide-react';
import { DrawingElement } from '../types';

interface LayerPanelProps {
  elements: DrawingElement[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onRename: (id: string, name: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorder: (sourceId: string, targetId: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const TYPE_LABELS: Partial<Record<DrawingElement['type'], string>> = {
  image: 'Image',
  text: 'Text',
  callout: 'Callout',
  symbol: 'Symbol',
  stamp: 'Stamp',
  spotlight: 'Spotlight',
  pen: 'Pen',
  highlighter: 'Highlight',
  rect: 'Rectangle',
  circle: 'Circle',
  triangle: 'Triangle',
  diamond: 'Diamond',
  line: 'Line',
  arrow: 'Arrow',
  pixelate: 'Mosaic',
};

const TYPE_MARKS: Partial<Record<DrawingElement['type'], string>> = {
  image: '🖼', text: 'T', callout: '💬', symbol: '★', stamp: '#', spotlight: '◉',
  pen: '✎', highlighter: '▂', rect: '□', circle: '○', triangle: '△', diamond: '◇',
  line: '╱', arrow: '↗', pixelate: '▒',
};

const getDefaultName = (element: DrawingElement, visualIndex: number) =>
  `${TYPE_LABELS[element.type] || element.type} ${visualIndex + 1}`;

const LayerPanel: React.FC<LayerPanelProps> = ({
  elements,
  selectedIds,
  onSelect,
  onRename,
  onToggleVisibility,
  onToggleLock,
  onReorder,
  onDuplicate,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const visualElements = [...elements].reverse();

  const commitRename = (element: DrawingElement, visualIndex: number) => {
    const nextName = editingName.trim() || getDefaultName(element, visualIndex);
    onRename(element.id, nextName);
    setEditingId(null);
  };

  if (collapsed) {
    return (
      <aside className="hidden h-full w-10 shrink-0 flex-col items-center border-r border-slate-200 bg-white py-2 transition-[width] dark:border-slate-700 dark:bg-slate-800 md:flex">
        <button type="button" onClick={() => setCollapsed(false)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-slate-700" title="Expand layers">
          <ChevronsRight size={16} />
        </button>
        <span className="mt-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">{elements.length}</span>
        <span className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400" style={{ writingMode: 'vertical-rl' }}>Layers</span>
      </aside>
    );
  }

  return (
    <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] dark:border-slate-700 dark:bg-slate-800 md:flex">
      <div className="flex h-10 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Layers</span>
        <div className="flex items-center gap-1">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">{elements.length}</span>
          <button type="button" onClick={() => setCollapsed(true)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-700" title="Collapse layers">
            <ChevronsLeft size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {visualElements.length === 0 && (
          <p className="px-3 py-8 text-center text-xs text-slate-400">Objects will appear here.</p>
        )}
        {visualElements.map((element, visualIndex) => {
          const selected = selectedIds.includes(element.id);
          const fallbackName = getDefaultName(element, visualIndex);
          return (
            <div
              key={element.id}
              draggable={editingId !== element.id}
              onDragStart={() => setDraggedId(element.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={event => event.preventDefault()}
              onDrop={() => {
                if (draggedId && draggedId !== element.id) onReorder(draggedId, element.id);
                setDraggedId(null);
              }}
              onClick={event => {
                if (event.shiftKey) {
                  onSelect(selected ? selectedIds.filter(id => id !== element.id) : [...selectedIds, element.id]);
                } else {
                  onSelect([element.id]);
                }
              }}
              className={`group mb-1 flex h-9 items-center gap-1 rounded-md border px-1 transition ${
                selected
                  ? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-200'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/70'
              } ${draggedId === element.id ? 'opacity-40' : ''}`}
            >
              <GripVertical size={13} className="shrink-0 cursor-grab text-slate-300 dark:text-slate-500" />
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white text-xs font-semibold shadow-sm dark:bg-slate-700">
                {TYPE_MARKS[element.type] || '◇'}
              </span>

              {editingId === element.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={event => setEditingName(event.target.value)}
                  onBlur={() => commitRename(element, visualIndex)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') commitRename(element, visualIndex);
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                  onClick={event => event.stopPropagation()}
                  className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 text-xs outline-none dark:bg-slate-700"
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={event => {
                    event.stopPropagation();
                    setEditingId(element.id);
                    setEditingName(element.name || fallbackName);
                  }}
                  className={`min-w-0 flex-1 truncate text-left text-xs ${element.hidden ? 'opacity-45 line-through' : ''}`}
                  title="Double-click to rename"
                >
                  {element.name || fallbackName}
                </button>
              )}

              <button
                type="button"
                onClick={event => { event.stopPropagation(); onToggleVisibility(element.id); }}
                className="rounded p-1 opacity-60 hover:bg-white hover:opacity-100 dark:hover:bg-slate-600"
                title={element.hidden ? 'Show layer' : 'Hide layer'}
              >
                {element.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                type="button"
                onClick={event => { event.stopPropagation(); onToggleLock(element.id); }}
                className={`rounded p-1 hover:bg-white dark:hover:bg-slate-600 ${element.locked ? 'text-red-500' : 'opacity-60 hover:opacity-100'}`}
                title={element.locked ? 'Unlock layer' : 'Lock layer'}
              >
                {element.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1 border-t border-slate-200 p-2 dark:border-slate-700">
        <button type="button" onClick={onDuplicate} disabled={selectedIds.length === 0} className="flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700">
          <Copy size={13} /> Duplicate
        </button>
        <button type="button" onClick={onDelete} disabled={selectedIds.length === 0} className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-950/30" title="Delete selected">
          <Trash2 size={14} />
        </button>
      </div>
    </aside>
  );
};

export default LayerPanel;
