import React from 'react';
import { ChevronsLeft, ChevronsRight, Copy, Trash2 } from 'lucide-react';
import { CalloutTail, DrawingElement, SpotlightShape, TextAlignment } from '../types';
import { getElementBounds } from '../utils/draw';
import { getElementSize, getMinimumToolSize } from '../utils/toolSettings';
import { getCalloutWorldTip, withCalloutWorldTip } from '../utils/callout';

interface PropertiesPanelProps {
  selectedElements: DrawingElement[];
  onGeometryChange: (id: string, values: { x?: number; y?: number; width?: number; height?: number }) => void;
  onStyleChange: (values: Partial<DrawingElement>) => void;
  onStylePreview: (values: Partial<DrawingElement>) => void;
  onStylePreviewCommit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

interface NumericFieldProps {
  label: string;
  value: number;
  min?: number;
  onCommit: (value: number) => void;
}

const NumericField: React.FC<NumericFieldProps> = ({ label, value, min, onCommit }) => (
  <label className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
    <span>{label}</span>
    <input
      key={`${label}-${Math.round(value * 100)}`}
      type="number"
      defaultValue={Math.round(value * 10) / 10}
      min={min}
      onBlur={event => {
        if (event.target.value.trim() === '') return;
        const parsed = Number(event.target.value);
        if (Number.isFinite(parsed)) onCommit(min === undefined ? parsed : Math.max(min, parsed));
      }}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs font-normal tracking-normal text-slate-700 outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
    />
  </label>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border-b border-slate-200 p-3 dark:border-slate-700">
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
    {children}
  </section>
);

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElements,
  onGeometryChange,
  onStyleChange,
  onStylePreview,
  onStylePreviewCommit,
  onDuplicate,
  onDelete,
}) => {
  const [collapsed, setCollapsed] = React.useState(true);
  const selected = selectedElements[selectedElements.length - 1];
  const bounds = selected ? getElementBounds(selected) : null;
  const isText = selected?.type === 'text' || selected?.type === 'callout';
  const calloutTip = selected?.type === 'callout' ? getCalloutWorldTip(selected) : undefined;

  if (collapsed) {
    return (
      <aside className="ui-panel panel-rail hidden h-full w-10 shrink-0 flex-col items-center border-l border-slate-200 bg-white py-2 transition-[width] dark:border-slate-700 dark:bg-slate-800 lg:flex">
        <button type="button" onClick={() => setCollapsed(false)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-slate-700" title="展開屬性">
          <ChevronsLeft size={16} />
        </button>
        {selectedElements.length > 0 && <span className="mt-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-700 dark:bg-slate-700 dark:text-brand-300">{selectedElements.length}</span>}
        <span className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400" style={{ writingMode: 'vertical-rl' }}>屬性</span>
      </aside>
    );
  }

  return (
    <aside className="ui-panel hidden h-full w-60 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 lg:flex">
      <div className="flex h-10 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">屬性</span>
        <div className="flex items-center gap-1">
          {selectedElements.length > 0 && <span className="text-[10px] text-slate-400">{selectedElements.length} 個已選取</span>}
          <button type="button" onClick={() => setCollapsed(true)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-700" title="收合屬性">
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>

      {!selected && <p className="px-5 py-10 text-center text-xs leading-5 text-slate-400">選取物件後，可調整位置、尺寸與外觀。</p>}

      {selected && bounds && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedElements.length === 1 && (
            <Section title="位置與尺寸">
              <div className="grid grid-cols-2 gap-2">
                <NumericField label="水平位置 X" value={bounds.x} onCommit={x => onGeometryChange(selected.id, { x })} />
                <NumericField label="垂直位置 Y" value={bounds.y} onCommit={y => onGeometryChange(selected.id, { y })} />
                <NumericField label="寬度" value={bounds.w} min={selected.type === 'stamp' || selected.type === 'symbol' ? 16 : 1} onCommit={width => onGeometryChange(selected.id, { width })} />
                <NumericField label="高度" value={bounds.h} min={selected.type === 'stamp' || selected.type === 'symbol' ? 16 : 1} onCommit={height => onGeometryChange(selected.id, { height })} />
              </div>
            </Section>
          )}

          <Section title="外觀">
            <div className="space-y-3">
              <label className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                顏色
                <input type="color" value={selected.color} onChange={event => onStylePreview({ color: event.target.value })} onBlur={onStylePreviewCommit} className="h-7 w-10 cursor-pointer rounded border border-slate-200 bg-transparent" />
              </label>
              <label className="block text-xs text-slate-600 dark:text-slate-300">
                <span className="mb-1 flex justify-between"><span>不透明度</span><span>{Math.round((selected.opacity ?? 1) * 100)}%</span></span>
                <input type="range" min="0.1" max="1" step="0.05" value={selected.opacity ?? 1} onChange={event => onStylePreview({ opacity: Number(event.target.value) })} onPointerUp={onStylePreviewCommit} onPointerCancel={onStylePreviewCommit} onKeyUp={onStylePreviewCommit} onBlur={onStylePreviewCommit} className="w-full accent-brand-600" />
              </label>
              {!isText && selected.type !== 'image' && selected.type !== 'spotlight' && !(selected.type === 'highlighter' && selected.highlighterStyle === 'rect') && (
                <NumericField
                  label={selected.type === 'stamp' || selected.type === 'symbol' ? '大小' : selected.type === 'pixelate' ? '效果強度' : selected.type === 'highlighter' ? '螢光筆寬度' : '線條粗細'}
                  value={getElementSize(selected)}
                  min={getMinimumToolSize(selected.type)}
                  onCommit={strokeWidth => onStyleChange({ strokeWidth })}
                />
              )}
            </div>
          </Section>

          {isText && (
            <Section title="文字">
              <div className="space-y-3">
                <NumericField label="字體大小" value={getElementSize(selected)} min={8} onCommit={fontSize => onStyleChange({ fontSize })} />
                <label className="block text-xs text-slate-600 dark:text-slate-300">
                  <span className="mb-1 block">文字對齊</span>
                  <select value={selected.textAlign ?? 'left'} onChange={event => onStyleChange({ textAlign: event.target.value as TextAlignment })} className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-700">
                    <option value="left">左方</option>
                    <option value="center">置中</option>
                    <option value="right">右方</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-600 dark:text-slate-300">
                  <span className="mb-1 flex justify-between"><span>行距</span><span>{(selected.lineHeight ?? 1.2).toFixed(1)}</span></span>
                  <input type="range" min="1" max="2" step="0.1" value={selected.lineHeight ?? 1.2} onChange={event => onStylePreview({ lineHeight: Number(event.target.value) })} onPointerUp={onStylePreviewCommit} onPointerCancel={onStylePreviewCommit} onKeyUp={onStylePreviewCommit} onBlur={onStylePreviewCommit} className="w-full accent-brand-600" />
                </label>
              </div>
            </Section>
          )}

          {selected.type === 'callout' && (
            <Section title="標註框">
              {calloutTip ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <NumericField label="箭頭終點 X" value={calloutTip.x} onCommit={x => onStyleChange({ calloutTip: withCalloutWorldTip(selected, { ...calloutTip, x }).calloutTip })} />
                    <NumericField label="箭頭終點 Y" value={calloutTip.y} onCommit={y => onStyleChange({ calloutTip: withCalloutWorldTip(selected, { ...calloutTip, y }).calloutTip })} />
                  </div>
                  <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">箭頭指向建立時滑鼠放開的位置。選取後可拖曳尖端的小圓點；連接方向會自動調整。</p>
                </div>
              ) : (
              <label className="block text-xs text-slate-600 dark:text-slate-300">
                <span className="mb-1 block">箭尾位置</span>
                <select value={selected.calloutTail ?? 'bottom-right'} onChange={event => onStyleChange({ calloutTail: event.target.value as CalloutTail })} className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-700">
                  <option value="bottom-right">右下</option>
                  <option value="bottom-left">左下</option>
                  <option value="top-right">右上</option>
                  <option value="top-left">左上</option>
                </select>
              </label>
              )}
            </Section>
          )}

          {selected.type === 'spotlight' && (
            <Section title="聚光燈">
              <div className="space-y-3">
                <label className="block text-xs text-slate-600 dark:text-slate-300">
                  <span className="mb-1 block">聚光形狀</span>
                  <select value={selected.spotlightShape ?? 'rect'} onChange={event => onStyleChange({ spotlightShape: event.target.value as SpotlightShape })} className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-700">
                    <option value="rect">矩形</option>
                    <option value="ellipse">橢圓形</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-600 dark:text-slate-300">
                  <span className="mb-1 flex justify-between"><span>背景遮罩強度</span><span>{Math.round((selected.spotlightOpacity ?? 0.58) * 100)}%</span></span>
                  <input type="range" min="0.15" max="0.85" step="0.05" value={selected.spotlightOpacity ?? 0.58} onChange={event => onStylePreview({ spotlightOpacity: Number(event.target.value) })} onPointerUp={onStylePreviewCommit} onPointerCancel={onStylePreviewCommit} onKeyUp={onStylePreviewCommit} onBlur={onStylePreviewCommit} className="w-full accent-brand-600" />
                </label>
              </div>
            </Section>
          )}
        </div>
      )}

      <div className="mt-auto flex gap-1 border-t border-slate-200 p-2 dark:border-slate-700">
        <button type="button" onClick={onDuplicate} disabled={!selected} className="flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700"><Copy size={13} /> 複製物件</button>
        <button type="button" onClick={onDelete} disabled={!selected} className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-950/30"><Trash2 size={14} /></button>
      </div>
    </aside>
  );
};

export default PropertiesPanel;
