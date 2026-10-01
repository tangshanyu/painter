import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { 
  MousePointer2, 
  Pen, 
  Highlighter, 
  Square, 
  Type, 
  Undo, 
  Redo, 
  Save, 
  Copy, 
  Trash2,
  Eraser,
  MoveUpRight,
  Files,
  Moon,
  Sun,
  Triangle,
  Stamp,
  Lock,
  Unlock,
  Crop,
  Grid3X3,
  BringToFront,
  SendToBack,
  ChevronUp,
  ChevronDown,
  Circle,
  FileX,
  Diamond,
  Minus,
  Droplets,
  Brush,
  FolderOpen,
  MonitorUp,
  Hand,
  MessageSquareText,
  Focus,
  SmilePlus,
  Star,
  MoreHorizontal,
  SlidersHorizontal
} from 'lucide-react';
import { ToolType, ToolSettings, DrawingElement, StampStyle } from '../types';
import { COLORS } from '../constants';
import { getMinimumToolSize } from '../utils/toolSettings';
import './SymbolLibrary.css';
import './Toolbar.css';
import { getToolbarLayout } from '../utils/toolbarLayout';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (t: ToolType) => void;
  settings: ToolSettings;
  setSettings: (s: ToolSettings) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  selectionCount: number;
  selectedElement?: DrawingElement; 
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onOpenFile: () => void;
  onScreenCapture: () => void;
  onCopy: () => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  onToggleLock: () => void;
  onLayerOrder: (action: 'front' | 'back' | 'forward' | 'backward') => void;
  onAlign: (action: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  stampCounter: number;
  setStampCounter: (n: number) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setTool,
  settings,
  setSettings,
  canUndo,
  canRedo,
  hasSelection,
  selectionCount,
  selectedElement,
  onUndo,
  onRedo,
  onSave,
  onSaveAll,
  onOpenFile,
  onScreenCapture,
  onCopy,
  onDeleteSelected,
  onClearAll,
  onToggleLock,
  onLayerOrder,
  onAlign,
  darkMode,
  toggleDarkMode,
  stampCounter,
  setStampCounter
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  type Popover = 'draw' | 'shape' | 'color' | 'size' | 'symbols' | 'settings' | 'more';
  const [openPopover, setOpenPopover] = useState<Popover | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const layout = getToolbarLayout(availableWidth);
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const observer = new ResizeObserver(() => setAvailableWidth(toolbar.clientWidth));
    setAvailableWidth(toolbar.clientWidth);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || !openPopover) return;
    const popup = toolbar.querySelector<HTMLElement>('.toolbar-popover');
    const anchor = toolbar.querySelector<HTMLElement>('button[aria-expanded="true"]');
    if (!popup || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popup.offsetWidth - 8));
    toolbar.style.setProperty('--toolbar-popover-left', `${left}px`);
    toolbar.style.setProperty('--toolbar-popover-top', `${toolbar.getBoundingClientRect().bottom + 4}px`);
  }, [openPopover, availableWidth, settings]);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [symbolCategory, setSymbolCategory] = useState<'all' | 'marks' | 'hands' | 'status' | 'emoji' | 'recent' | 'favorites'>('all');
  const [recentSymbols, setRecentSymbols] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('painter-recent-symbols') || '[]');
      return Array.isArray(stored) ? stored.filter(value => typeof value === 'string') : [];
    } catch { return []; }
  });
  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('painter-favorite-symbols') || '[]');
      return Array.isArray(stored) ? stored.filter(value => typeof value === 'string') : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem('painter-recent-symbols', JSON.stringify(recentSymbols)); } catch { /* Storage can be unavailable in private contexts. */ }
  }, [recentSymbols]);

  useEffect(() => {
    try { localStorage.setItem('painter-favorite-symbols', JSON.stringify(favoriteSymbols)); } catch { /* Storage can be unavailable in private contexts. */ }
  }, [favoriteSymbols]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setOpenPopover(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPopover(null);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const selectTool = (tool: ToolType) => {
    setTool(tool);
    setOpenPopover(null);
  };

  const togglePopover = (popover: Popover) => {
    setOpenPopover(current => current === popover ? null : popover);
  };
  
  // Tools that appear directly on the bar (Standalone)
  const mainTools = [
    { id: 'select', icon: MousePointer2, label: '選取' },
    { id: 'hand', icon: Hand, label: '移動畫布' },
    { id: 'crop', icon: Crop, label: '裁切' },
    { id: 'eraser', icon: Eraser, label: '區域橡皮擦' },
    // Pen, Highlighter, Pixelate moved to drawTools group
    { id: 'arrow', icon: MoveUpRight, label: '箭頭' },
    { id: 'stamp', icon: Stamp, label: '印章' },
    { id: 'text', icon: Type, label: '文字' },
    { id: 'callout', icon: MessageSquareText, label: '標註框' },
    { id: 'spotlight', icon: Focus, label: '聚光燈' },
  ] as const;

  // New Group: Drawing & Effects
  const drawTools = [
      { id: 'pen', icon: Pen, label: '畫筆' },
      { id: 'highlighter', icon: Highlighter, label: '螢光筆' },
      { id: 'pixelate', icon: Grid3X3, label: '馬賽克／模糊' },
  ] as const;

  // Group: Shapes
  const shapeTools = [
      { id: 'rect', icon: Square, label: '矩形' },
      { id: 'circle', icon: Circle, label: '圓形' },
      { id: 'triangle', icon: Triangle, label: '三角形' },
      { id: 'diamond', icon: Diamond, label: '菱形' },
      { id: 'line', icon: Minus, label: '直線' },
  ] as const;

  // --- Logic for Drawing Tools Group ---
  const isDrawActive = drawTools.some(t => t.id === currentTool);
  const [lastDrawTool, setLastDrawTool] = useState<ToolType>('pen');

  useEffect(() => {
    if (isDrawActive) {
      setLastDrawTool(currentTool);
    }
  }, [currentTool, isDrawActive]);

  const activeDrawDef = drawTools.find(t => t.id === lastDrawTool) || drawTools[0];

  // --- Logic for Shape Tools Group ---
  const isShapeActive = shapeTools.some(t => t.id === currentTool);
  const [lastShape, setLastShape] = useState<ToolType>('rect');

  useEffect(() => {
    if (isShapeActive) {
      setLastShape(currentTool);
    }
  }, [currentTool, isShapeActive]);

  const activeShapeDef = shapeTools.find(t => t.id === lastShape) || shapeTools[0];

  const DEFAULT_SIZES = [2, 4, 8, 12, 20];
  const WIDE_SIZES = [4, 8, 12, 20, 32];
  const STAMP_SIZES = [24, 32, 48, 64, 96];
  const SYMBOL_SIZES = [24, 32, 48, 64, 96];
  const TEXT_SIZES = [
      12, 18, 24, 36, 48, 72,
  ];

  const editingElement = currentTool === 'select' ? selectedElement : undefined;
  const sizeTarget = editingElement?.type ?? currentTool;
  const rectangularHighlighter = sizeTarget === 'highlighter' && settings.highlighterStyle === 'rect';
  const supportsSize = !rectangularHighlighter && ['pen', 'highlighter', 'rect', 'circle', 'triangle', 'diamond', 'line', 'arrow', 'text', 'callout', 'stamp', 'symbol', 'pixelate'].includes(sizeTarget);
  const isTextSize = sizeTarget === 'text' || sizeTarget === 'callout';
  const currentSize = isTextSize ? settings.fontSize : settings.strokeWidth;
  const sizePresets = sizeTarget === 'stamp'
    ? STAMP_SIZES
    : sizeTarget === 'symbol'
      ? SYMBOL_SIZES
      : sizeTarget === 'highlighter' || sizeTarget === 'pixelate'
        ? WIDE_SIZES
        : DEFAULT_SIZES;
  const sizeLabel = isTextSize
    ? '字體大小'
    : sizeTarget === 'pixelate'
      ? '馬賽克／模糊強度'
      : sizeTarget === 'stamp'
        ? '印章大小'
        : sizeTarget === 'symbol'
          ? '符號大小'
          : sizeTarget === 'highlighter'
            ? '螢光筆寬度'
            : '線條粗細';
  const sizeContextLabel = editingElement ? `已選物件的${sizeLabel}` : `下一個物件的${sizeLabel}`;
  const contextualTool = editingElement?.type ?? currentTool;
  const stampStyles: Array<{ id: StampStyle; label: string }> = [
    { id: 'circle', label: '圓形印章' },
    { id: 'square', label: '方形印章' },
    { id: 'rounded', label: '圓角印章' },
    { id: 'diamond', label: '菱形印章' },
    { id: 'plain', label: '純數字' },
  ];
  const symbols = [
    { value: '✓', label: '勾選', category: 'marks' },
    { value: '✕', label: '叉號', category: 'marks' },
    { value: '☐', label: '空白核取框', category: 'marks' },
    { value: '☑', label: '已勾選核取框', category: 'marks' },
    { value: '★', label: '星號', category: 'marks' },
    { value: '●', label: '圓點', category: 'marks' },
    { value: '→', label: '向右箭頭', category: 'marks' },
    { value: '←', label: '向左箭頭', category: 'marks' },
    { value: '⚠️', label: '警告', category: 'status' },
    { value: 'ℹ️', label: '資訊', category: 'status' },
    { value: '❗', label: '驚嘆號', category: 'status' },
    { value: '❓', label: '問號', category: 'status' },
    { value: '🚫', label: '禁止', category: 'status' },
    { value: '🎯', label: '目標', category: 'status' },
    { value: '💡', label: '靈感', category: 'status' },
    { value: '🚀', label: '火箭', category: 'status' },
    { value: '👉', label: '手指向右', category: 'hands' },
    { value: '👈', label: '手指向左', category: 'hands' },
    { value: '👆', label: '手指向上', category: 'hands' },
    { value: '👇', label: '手指向下', category: 'hands' },
    { value: '👍', label: '讚', category: 'hands' },
    { value: '👎', label: '倒讚', category: 'hands' },
    { value: '👌', label: '好手勢', category: 'hands' },
    { value: '👏', label: '拍手', category: 'hands' },
    { value: '😀', label: '笑臉', category: 'emoji' },
    { value: '😊', label: '開心', category: 'emoji' },
    { value: '🤔', label: '思考', category: 'emoji' },
    { value: '😮', label: '驚訝', category: 'emoji' },
    { value: '❤️', label: '愛心', category: 'emoji' },
    { value: '🔥', label: '火焰', category: 'emoji' },
    { value: '🎉', label: '慶祝', category: 'emoji' },
    { value: '📌', label: '圖釘', category: 'emoji' },
  ];
  const customSavedSymbols = [...new Set([...recentSymbols, ...favoriteSymbols])]
    .filter(value => !symbols.some(item => item.value === value))
    .map(value => ({ value, label: `自訂 ${value}`, category: 'emoji' }));
  const availableSymbols = [...symbols, ...customSavedSymbols];
  const normalizedSearch = symbolSearch.trim().toLowerCase();
  const customSymbol = symbolSearch.trim();
  const canUseCustomSymbol = customSymbol.length > 0 && Array.from(customSymbol).length <= 4 && !/^[a-z0-9 ]+$/i.test(customSymbol);
  const filteredSymbols = availableSymbols.filter(item => {
    const categoryMatch = symbolCategory === 'all'
      || (symbolCategory === 'recent' && recentSymbols.includes(item.value))
      || (symbolCategory === 'favorites' && favoriteSymbols.includes(item.value))
      || item.category === symbolCategory;
    return categoryMatch && (!normalizedSearch || item.label.toLowerCase().includes(normalizedSearch) || item.value.includes(symbolSearch.trim()));
  }).sort((a, b) => {
    if (symbolCategory === 'recent') return recentSymbols.indexOf(a.value) - recentSymbols.indexOf(b.value);
    return 0;
  });

  const chooseSymbol = (value: string) => {
    setSettings({ ...settings, symbol: value });
    setRecentSymbols(current => [value, ...current.filter(symbol => symbol !== value)].slice(0, 12));
    setOpenPopover(null);
  };

  const toggleFavoriteSymbol = (value: string) => {
    setFavoriteSymbols(current => current.includes(value) ? current.filter(symbol => symbol !== value) : [...current, value]);
  };

  // Glass panel style
  const glassPanelClass = "ui-popover toolbar-popover p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl flex flex-wrap gap-2 min-w-[180px] justify-center z-50";
  const visibleTool = (tool: ToolType) => layout.direct.includes(tool) || currentTool === tool;

  return (
    <div ref={toolbarRef} data-labels={layout.labels} className="editor-toolbar w-full bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-50 sticky top-0 transition-colors" role="toolbar" aria-label="編輯工具列">
      
      {/* Tools Group */}
      <div className="tool-group flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg gap-0.5 shrink-0">
        
        {/* Render Select, Hand, Crop, Eraser first */}
        {mainTools.slice(0, 4).filter(t => visibleTool(t.id)).map((t) => (
          <button
            key={t.id}
            onClick={() => selectTool(t.id as ToolType)}
            aria-pressed={currentTool === t.id}
            title={t.label}
            className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
              currentTool === t.id 
                ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/10' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <t.icon size={18} />
          </button>
        ))}

        {/* Drawing Tools Group (Pen, Highlighter, Pixelate) */}
        <div className="relative">
            <button
                onClick={() => {
                  setTool(lastDrawTool);
                  togglePopover('draw');
                }}
                aria-expanded={openPopover === 'draw'}
                aria-pressed={isDrawActive}
                className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                isDrawActive
                    ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/10' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
                title={`畫筆：${activeDrawDef.label}`}
            >
                {/* Show the last used drawing tool icon */}
                {React.createElement(activeDrawDef.icon, { size: 18 })}
            </button>
            
            {openPopover === 'draw' && <div className={glassPanelClass}>
                <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300 mb-1">畫筆與效果</div>
                <div className="flex items-center gap-2">
                    {drawTools.map((t) => (
                         <button
                            key={t.id}
                            onClick={() => selectTool(t.id as ToolType)}
                            title={t.label}
                            className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                            currentTool === t.id 
                                ? 'bg-brand-100 dark:bg-slate-600 text-brand-600 dark:text-brand-400 shadow-sm' 
                                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-600/50'
                            }`}
                        >
                            <t.icon size={20} />
                        </button>
                    ))}
                </div>
            </div>}
        </div>

        {/* Shapes Group */}
        {(layout.shapes || isShapeActive) && <div className="relative">
            <button
                onClick={() => {
                  setTool(lastShape);
                  togglePopover('shape');
                }}
                aria-expanded={openPopover === 'shape'}
                aria-pressed={isShapeActive}
                className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                isShapeActive
                    ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/10' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
                title={`形狀：${activeShapeDef.label}`}
            >
                {/* Show the last used shape icon */}
                {React.createElement(activeShapeDef.icon, { size: 18 })}
            </button>
            
            {openPopover === 'shape' && <div className={glassPanelClass}>
                <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300 mb-1">幾何圖形</div>
                <div className="flex items-center gap-2">
                    {shapeTools.map((t) => (
                         <button
                            key={t.id}
                            onClick={() => selectTool(t.id as ToolType)}
                            title={t.label}
                            className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                            currentTool === t.id 
                                ? 'bg-brand-100 dark:bg-slate-600 text-brand-600 dark:text-brand-400 shadow-sm' 
                                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-600/50'
                            }`}
                        >
                            <t.icon size={20} />
                        </button>
                    ))}
                </div>
            </div>}
        </div>

        }
        {/* Render remaining direct tools */}
        {mainTools.slice(4).filter(t => visibleTool(t.id)).map((t) => (
          <button
            key={t.id}
            onClick={() => selectTool(t.id as ToolType)}
            aria-pressed={currentTool === t.id}
            aria-label={t.label}
            title={t.id === 'callout' ? '標註框：按下建立文字框，拖曳放開指定箭頭終點' : t.label}
            className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
              currentTool === t.id 
                ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/10' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <t.icon size={18} />
          </button>
        ))}

        {(layout.symbols || currentTool === 'symbol') && <div className="relative">
          <button
            onClick={() => {
              setTool('symbol');
              togglePopover('symbols');
            }}
            aria-expanded={openPopover === 'symbols'}
            aria-pressed={currentTool === 'symbol'}
            title="圖示與符號庫"
            className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
              currentTool === 'symbol'
                ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/10'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {currentTool === 'symbol' ? <span className="flex h-[18px] w-[18px] items-center justify-center text-lg leading-none" aria-hidden="true">{settings.symbol}</span> : <SmilePlus size={18} />}
          </button>

          {openPopover === 'symbols' && (
            <div className={`${glassPanelClass} w-[340px] flex-col flex-nowrap items-stretch`}>
              <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300">圖示、符號與表情符號</div>
              <input
                autoFocus
                value={symbolSearch}
                onChange={event => setSymbolSearch(event.target.value)}
                placeholder="搜尋中文名稱或貼上表情符號…"
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <div className="flex w-full gap-1 overflow-x-auto pb-1">
                {([
                  ['all', '全部'], ['marks', '標記'], ['hands', '手勢'], ['status', '狀態'],
                  ['emoji', '表情'], ['recent', '最近使用'], ['favorites', '收藏'],
                ] as const).map(([category, label]) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSymbolCategory(category)}
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${symbolCategory === category ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="symbol-library-grid grid max-h-52 w-full grid-cols-7 gap-1.5 overflow-y-auto p-0.5">
                {filteredSymbols.map(item => (
                  <div key={item.label} className="symbol-item relative">
                    <button
                      onClick={() => chooseSymbol(item.value)}
                      title={item.label}
                      aria-label={item.label}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-brand-50 dark:hover:bg-slate-600 ${settings.symbol === item.value ? 'bg-brand-100 ring-1 ring-brand-400 dark:bg-slate-600' : 'bg-white/60 dark:bg-slate-700/60'}`}
                    >
                      {item.value}
                    </button>
                    <button
                      type="button"
                      onClick={event => { event.stopPropagation(); toggleFavoriteSymbol(item.value); }}
                      className="symbol-favorite"
                      data-favorite={favoriteSymbols.includes(item.value)}
                      aria-pressed={favoriteSymbols.includes(item.value)}
                      aria-label={`${favoriteSymbols.includes(item.value) ? '取消收藏' : '收藏'}${item.label}`}
                      title={`${favoriteSymbols.includes(item.value) ? '取消收藏' : '收藏'}${item.label}`}
                    >
                      <Star size={10} fill={favoriteSymbols.includes(item.value) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                ))}
              </div>
              {filteredSymbols.length === 0 && !canUseCustomSymbol && <p className="w-full py-4 text-center text-xs text-slate-400">找不到符合的符號。</p>}
              {canUseCustomSymbol && !availableSymbols.some(item => item.value === customSymbol) && (
                <button type="button" onClick={() => chooseSymbol(customSymbol)} className="w-full rounded-lg border border-dashed border-brand-300 px-3 py-2 text-xs text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-700">
                  使用自訂符號 <span className="ml-2 text-lg">{customSymbol}</span>
                </button>
              )}
            </div>
          )}
        </div>}

      </div>

      {/* Color Picker (Liquid Glass Popover) */}
      {layout.quickSettings && <div className="relative shrink-0">
          <button 
              onClick={() => togglePopover('color')}
              aria-expanded={openPopover === 'color'}
              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="顏色設定"
          >
              <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-black/10" style={{ backgroundColor: settings.color }}></div>
          </button>
          
          {openPopover === 'color' && <div className={glassPanelClass}>
              <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300 mb-1">顏色選擇</div>
               {COLORS.map((c) => (
                <button
                    key={c}
                    onClick={() => {
                      setSettings({ ...settings, color: c });
                      setOpenPopover(null);
                    }}
                    className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 transition-transform hover:scale-110 shadow-sm ${
                    settings.color === c ? 'ring-2 ring-brand-500 scale-110' : ''
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                />
                ))}
                <div className="w-px h-6 bg-slate-400/30 mx-1"></div>
                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-slate-200 shadow-sm cursor-pointer hover:scale-110 transition-transform">
                     <div className="absolute inset-0 bg-gradient-to-br from-red-500 via-green-500 to-blue-500"></div>
                     <input 
                        type="color" 
                        value={settings.color}
                        onChange={(e) => setSettings({...settings, color: e.target.value})}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        title="自訂顏色"
                    />
                </div>
          </div>}
      </div>}

      {/* Each tool keeps its own remembered size. */}
      {supportsSize && layout.quickSettings && <div className="relative shrink-0">
          <button 
              onClick={() => togglePopover('size')}
              aria-expanded={openPopover === 'size'}
              aria-label={`${sizeLabel}: ${currentSize}px`}
              className="h-8 min-w-[3.5rem] rounded-lg border border-slate-200 px-2 dark:border-slate-600 flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
              title={`${sizeContextLabel}: ${currentSize}px`}
          >
             {isTextSize ? (
                  <Type size={16} />
              ) : (
                 <div
                    className="rounded-full bg-slate-800 dark:bg-slate-200" 
                    style={{ 
                        width: Math.max(4, Math.min(14, currentSize)),
                        height: Math.max(4, Math.min(14, currentSize))
                     }}
                 />
              )}
              <span className="text-[10px] font-semibold tabular-nums">{currentSize}</span>
          </button>

          {openPopover === 'size' && <div className={glassPanelClass}>
              <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300 mb-1">
                  {sizeContextLabel} · {currentSize}px
              </div>

              {isTextSize ? (
                   <div className="flex flex-col gap-1 w-full">
                       {TEXT_SIZES.map(size => (
                            <button
                                key={size}
                                onClick={() => {
                                  setSettings({ ...settings, fontSize: size });
                                  setOpenPopover(null);
                                }}
                                className={`px-2 py-1 text-xs rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-left ${
                                    settings.fontSize === size ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-bold' : 'text-slate-700 dark:text-slate-200'
                                }`}
                           >
                               {size}px
                           </button>
                       ))}
                   </div>
              ) : (
                   <div className="flex items-center gap-2">
                       {sizePresets.map((size) => (
                        <button
                            key={size}
                            onClick={() => {
                              setSettings({ ...settings, strokeWidth: size });
                              setOpenPopover(null);
                            }}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/50 dark:hover:bg-slate-600/50 transition-colors ${settings.strokeWidth === size ? 'bg-slate-200 dark:bg-slate-600 ring-1 ring-slate-400' : ''}`}
                            title={`${size}px`}
                            aria-label={`${size}px`}
                            aria-pressed={currentSize === size}
                        >
                            <span className="text-xs font-semibold tabular-nums">{size}</span>
                        </button>
                        ))}
                   </div>
              )}
              <label className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                自訂大小（px）
                <input key={`${sizeTarget}-${currentSize}`} type="number" aria-label={`自訂${sizeLabel}`} min={getMinimumToolSize(sizeTarget)} step="1" defaultValue={currentSize}
                  onBlur={event => {
                    if (event.target.value.trim() === '') return;
                    const parsed = Number(event.target.value);
                    if (!Number.isFinite(parsed)) return;
                    const size = Math.max(getMinimumToolSize(sizeTarget), parsed);
                    setSettings(isTextSize ? { ...settings, fontSize: size } : { ...settings, strokeWidth: size });
                  }}
                  onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                  className="w-16 rounded border border-slate-200 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-700" />
              </label>
          </div>}
      </div>}

      <div className="relative shrink-0">
        <button type="button" title="目前工具設定" aria-label="目前工具設定" aria-expanded={openPopover === 'settings'} onClick={() => togglePopover('settings')} className="toolbar-icon text-slate-600 dark:text-slate-300"><SlidersHorizontal size={18} /></button>
        {openPopover === 'settings' && <div className={`${glassPanelClass} toolbar-settings`} role="dialog" aria-label="目前工具設定">
          <strong className="w-full text-xs text-slate-700 dark:text-slate-200">{editingElement ? '已選物件設定' : '下一個物件設定'}</strong>
          <label className="flex w-full items-center justify-between text-xs text-slate-600 dark:text-slate-300">顏色<input type="color" aria-label="工具顏色" value={settings.color} onChange={event => setSettings({ ...settings, color: event.target.value })} /></label>
          {supportsSize && <label className="flex w-full items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">{sizeLabel}<input key={`${sizeTarget}-${currentSize}`} aria-label={`設定${sizeLabel}`} type="number" min={getMinimumToolSize(sizeTarget)} defaultValue={currentSize} className="w-20 rounded border border-slate-300 bg-transparent p-1 dark:border-slate-600" onBlur={event => { if (event.target.value.trim() === '') return; const size = Number(event.target.value); if (Number.isFinite(size)) setSettings(isTextSize ? { ...settings, fontSize: Math.max(getMinimumToolSize(sizeTarget), size) } : { ...settings, strokeWidth: Math.max(getMinimumToolSize(sizeTarget), size) }); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>}
      {/* Tool-specific options live in a popup and never change the toolbar height. */}
      {(contextualTool === 'arrow' || contextualTool === 'stamp' || contextualTool === 'pixelate' || contextualTool === 'highlighter') && (
        <>
            
            {contextualTool === 'stamp' && (
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 p-0.5 rounded-md">
                     <div className="flex bg-slate-200 dark:bg-slate-600 rounded p-0.5 gap-0.5">
                        {stampStyles.map(option => (
                          <button
                              key={option.id}
                              onClick={() => setSettings({ ...settings, stampStyle: option.id })}
                              className={`flex h-6 w-6 items-center justify-center rounded transition ${settings.stampStyle === option.id ? 'bg-white dark:bg-slate-500 shadow text-brand-600' : 'text-slate-500 hover:bg-white/60 dark:hover:bg-slate-500/60'}`}
                              title={option.label}
                              aria-label={option.label}
                          >
                              {option.id === 'plain' ? (
                                <span className="text-xs font-bold">1</span>
                              ) : (
                                <span className={`block border-2 border-current ${
                                  option.id === 'circle' ? 'h-3.5 w-3.5 rounded-full' :
                                  option.id === 'rounded' ? 'h-3.5 w-4 rounded-[5px]' :
                                  option.id === 'diamond' ? 'h-3 w-3 rotate-45' :
                                  'h-3.5 w-3.5'
                                }`} />
                              )}
                          </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">編號</span>
                        <input 
                            type="number"
                            aria-label="印章編號"
                            value={stampCounter}
                            onChange={(e) => setStampCounter(parseInt(e.target.value) || 1)}
                            className="w-10 h-6 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-slate-200"
                        />
                    </div>
                </div>
            )}

            {contextualTool === 'pixelate' && (
                <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-md gap-0.5">
                    <button
                        onClick={() => setSettings({ ...settings, pixelateStyle: 'pixel' })}
                        title="像素馬賽克"
                        className={`p-1.5 rounded transition-all ${
                            settings.pixelateStyle === 'pixel'
                            ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <Grid3X3 size={14} />
                    </button>
                    <button
                        onClick={() => setSettings({ ...settings, pixelateStyle: 'blur' })}
                        title="平滑模糊"
                        className={`p-1.5 rounded transition-all ${
                            settings.pixelateStyle === 'blur'
                            ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <Droplets size={14} />
                    </button>
                </div>
            )}

            {contextualTool === 'highlighter' && (
                <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-md gap-0.5">
                    <button
                        onClick={() => setSettings({ ...settings, highlighterStyle: 'brush' })}
                        title="自由塗畫"
                        className={`p-1.5 rounded transition-all ${
                            settings.highlighterStyle === 'brush'
                            ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <Brush size={14} />
                    </button>
                    <button
                        onClick={() => setSettings({ ...settings, highlighterStyle: 'rect' })}
                        title="矩形區域"
                        className={`p-1.5 rounded transition-all ${
                            settings.highlighterStyle === 'rect'
                            ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <Square size={14} strokeWidth={3} className="opacity-50" />
                    </button>
                </div>
            )}

            {contextualTool === 'arrow' && (
                <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-md gap-0.5">
                    <button
                        onClick={() => setSettings({ ...settings, arrowStyle: 'filled' })}
                        title="實心箭頭"
                        className={`p-1.5 rounded transition-all ${
                            settings.arrowStyle === 'filled'
                            ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <Triangle size={14} fill="currentColor" />
                    </button>
                    <button
                        onClick={() => setSettings({ ...settings, arrowStyle: 'outline' })}
                        title="空心箭頭"
                        className={`p-1.5 rounded transition-all ${
                            settings.arrowStyle === 'outline'
                            ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <Triangle size={14} />
                    </button>
                </div>
            )}
        </>
      )}
        </div>}
      </div>

      {layout.history && <div className="toolbar-history text-slate-600 dark:text-slate-300">
        <button type="button" className="toolbar-icon" title="復原（Ctrl＋Z）" aria-label="復原（Ctrl＋Z）" disabled={!canUndo} onClick={onUndo}><Undo size={16} /></button>
        <button type="button" className="toolbar-icon" title="重做（Ctrl＋Shift＋Z）" aria-label="重做（Ctrl＋Shift＋Z）" disabled={!canRedo} onClick={onRedo}><Redo size={16} /></button>
      </div>}
      <div className="toolbar-actions text-slate-600 dark:text-slate-300">
        {layout.capture && <button type="button" data-action="tonal" title="擷取螢幕（Alt＋S）" aria-label="擷取" onClick={onScreenCapture}><MonitorUp size={16} /><span>擷取</span></button>}
        {layout.copy && <button type="button" data-action="tonal" title="複製（Ctrl＋C）" aria-label="複製" onClick={onCopy}><Copy size={16} /><span>複製</span></button>}
        <button type="button" data-action="primary" title="匯出目前圖片" aria-label="匯出" onClick={onSave} className="bg-brand-600 text-white"><Save size={16} /><span>匯出</span></button>
        <button type="button" data-action="secondary" title="匯出所有分頁" aria-label="全部匯出" onClick={onSaveAll} className="bg-slate-700 text-white"><Files size={16} /><span>全部匯出</span></button>
        <div className="relative">
          <button type="button" className="toolbar-icon" aria-label="更多工具與操作" title="更多工具與操作" aria-expanded={openPopover === 'more'} onClick={() => togglePopover('more')}><MoreHorizontal size={18} /></button>
          {openPopover === 'more' && <div className={`${glassPanelClass} toolbar-more`} role="dialog" aria-label="更多工具與操作">
            <strong className="w-full text-xs">所有工具</strong>
            <div className="toolbar-tool-grid">{[...mainTools, ...drawTools, ...shapeTools, { id: 'symbol', icon: SmilePlus, label: '圖示與符號庫' }].map(tool => <button key={tool.id} type="button" title={tool.label} aria-label={`切換至${tool.label}`} aria-pressed={currentTool === tool.id} onClick={() => { selectTool(tool.id as ToolType); if (tool.id === 'symbol') setOpenPopover('symbols'); }}><tool.icon size={17} /><span>{tool.label}</span></button>)}</div>
            <strong className="w-full text-xs">檔案與編輯</strong>
            <div className="toolbar-menu-grid">{[
              { label: '復原', icon: Undo, action: onUndo, disabled: !canUndo },
              { label: '重做', icon: Redo, action: onRedo, disabled: !canRedo },
              { label: '開啟圖片', icon: FolderOpen, action: onOpenFile },
              { label: '擷取螢幕', icon: MonitorUp, action: onScreenCapture },
              { label: '複製', icon: Copy, action: onCopy },
              { label: '刪除選取物件', icon: Trash2, action: onDeleteSelected, disabled: !hasSelection },
              { label: '清除所有標註', icon: FileX, action: onClearAll },
              { label: selectedElement?.locked ? '解除鎖定' : '鎖定', icon: selectedElement?.locked ? Unlock : Lock, action: onToggleLock, disabled: !hasSelection },
              { label: darkMode ? '切換亮色模式' : '切換暗色模式', icon: darkMode ? Sun : Moon, action: toggleDarkMode },
            ].map(item => <button key={item.label} type="button" disabled={item.disabled} onClick={() => { setOpenPopover(null); item.action(); }}><item.icon size={16} />{item.label}</button>)}</div>
            {hasSelection && <><strong className="w-full text-xs">圖層順序</strong><div className="toolbar-menu-grid">{([
              ['front', '移至最上層', BringToFront], ['forward', '向上移一層', ChevronUp],
              ['backward', '向下移一層', ChevronDown], ['back', '移至最下層', SendToBack],
            ] as const).map(([action, label, Icon]) => <button type="button" key={action} onClick={() => { onLayerOrder(action); setOpenPopover(null); }}><Icon size={16} />{label}</button>)}</div></>}
            {selectionCount > 1 && <><strong className="w-full text-xs">對齊 {selectionCount} 個物件</strong><div className="toolbar-menu-grid">{([
              ['left', '靠左對齊'], ['centerX', '水平置中'], ['right', '靠右對齊'],
              ['top', '靠上對齊'], ['centerY', '垂直置中'], ['bottom', '靠下對齊'],
            ] as const).map(([action, label]) => <button type="button" key={action} onClick={() => { onAlign(action); setOpenPopover(null); }}>{label}</button>)}</div></>}
          </div>}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
