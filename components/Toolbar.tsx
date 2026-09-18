import React, { useState, useEffect, useRef } from 'react';
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
  Star
} from 'lucide-react';
import { ToolType, ToolSettings, DrawingElement, StampStyle } from '../types';
import { COLORS } from '../constants';

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
  const [openPopover, setOpenPopover] = useState<'draw' | 'shape' | 'color' | 'size' | 'symbols' | null>(null);
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

  const togglePopover = (popover: 'draw' | 'shape' | 'color' | 'size' | 'symbols') => {
    setOpenPopover(current => current === popover ? null : popover);
  };
  
  // Tools that appear directly on the bar (Standalone)
  const mainTools = [
    { id: 'select', icon: MousePointer2, label: 'Select' }, 
    { id: 'hand', icon: Hand, label: 'Pan canvas' },
    { id: 'crop', icon: Crop, label: 'Crop Tool' },
    { id: 'eraser', icon: Eraser, label: 'Area Eraser' },
    // Pen, Highlighter, Pixelate moved to drawTools group
    { id: 'arrow', icon: MoveUpRight, label: 'Arrow' },
    { id: 'stamp', icon: Stamp, label: 'Stamp' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'callout', icon: MessageSquareText, label: 'Callout' },
    { id: 'spotlight', icon: Focus, label: 'Spotlight' },
  ] as const;

  // New Group: Drawing & Effects
  const drawTools = [
      { id: 'pen', icon: Pen, label: 'Pen' },
      { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
      { id: 'pixelate', icon: Grid3X3, label: 'Mosaic / Blur' }, 
  ] as const;

  // Group: Shapes
  const shapeTools = [
      { id: 'rect', icon: Square, label: 'Rectangle' },
      { id: 'circle', icon: Circle, label: 'Circle' },
      { id: 'triangle', icon: Triangle, label: 'Triangle' },
      { id: 'diamond', icon: Diamond, label: 'Diamond' },
      { id: 'line', icon: Minus, label: 'Line' },
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

  const sizeTarget = selectedElement?.type ?? currentTool;
  const supportsSize = ['pen', 'highlighter', 'rect', 'circle', 'triangle', 'diamond', 'line', 'arrow', 'text', 'callout', 'stamp', 'symbol', 'pixelate'].includes(sizeTarget);
  const isTextSize = sizeTarget === 'text' || sizeTarget === 'callout';
  const rawCurrentSize = isTextSize ? settings.fontSize : settings.strokeWidth;
  const currentSize = sizeTarget === 'stamp' && rawCurrentSize < 20 ? (10 + rawCurrentSize) * 2 : rawCurrentSize;
  const sizePresets = sizeTarget === 'stamp'
    ? STAMP_SIZES
    : sizeTarget === 'symbol'
      ? SYMBOL_SIZES
      : sizeTarget === 'highlighter' || sizeTarget === 'pixelate'
        ? WIDE_SIZES
        : DEFAULT_SIZES;
  const sizeLabel = isTextSize
    ? 'Font size'
    : sizeTarget === 'pixelate'
      ? 'Mosaic / blur size'
      : sizeTarget === 'stamp'
        ? 'Stamp size'
        : sizeTarget === 'symbol'
          ? 'Symbol size'
          : sizeTarget === 'highlighter'
            ? 'Highlighter width'
            : 'Stroke width';
  const sizeContextLabel = selectedElement ? `Selected ${sizeLabel.toLowerCase()}` : `Next ${sizeLabel.toLowerCase()}`;
  const contextualTool = selectedElement?.type ?? currentTool;
  const stampStyles: Array<{ id: StampStyle; label: string }> = [
    { id: 'circle', label: 'Circle stamp' },
    { id: 'square', label: 'Square stamp' },
    { id: 'rounded', label: 'Rounded stamp' },
    { id: 'diamond', label: 'Diamond stamp' },
    { id: 'plain', label: 'Number only' },
  ];
  const symbols = [
    { value: '✓', label: 'Check', category: 'marks' },
    { value: '✕', label: 'Cross', category: 'marks' },
    { value: '☐', label: 'Checkbox', category: 'marks' },
    { value: '☑', label: 'Checked box', category: 'marks' },
    { value: '★', label: 'Star', category: 'marks' },
    { value: '●', label: 'Dot', category: 'marks' },
    { value: '→', label: 'Right arrow', category: 'marks' },
    { value: '←', label: 'Left arrow', category: 'marks' },
    { value: '⚠️', label: 'Warning', category: 'status' },
    { value: 'ℹ️', label: 'Information', category: 'status' },
    { value: '❗', label: 'Exclamation', category: 'status' },
    { value: '❓', label: 'Question', category: 'status' },
    { value: '🚫', label: 'Forbidden', category: 'status' },
    { value: '🎯', label: 'Target', category: 'status' },
    { value: '💡', label: 'Idea', category: 'status' },
    { value: '🚀', label: 'Rocket', category: 'status' },
    { value: '👉', label: 'Point right', category: 'hands' },
    { value: '👈', label: 'Point left', category: 'hands' },
    { value: '👆', label: 'Point up', category: 'hands' },
    { value: '👇', label: 'Point down', category: 'hands' },
    { value: '👍', label: 'Thumbs up', category: 'hands' },
    { value: '👎', label: 'Thumbs down', category: 'hands' },
    { value: '👌', label: 'OK hand', category: 'hands' },
    { value: '👏', label: 'Clap', category: 'hands' },
    { value: '😀', label: 'Smile', category: 'emoji' },
    { value: '😊', label: 'Happy', category: 'emoji' },
    { value: '🤔', label: 'Thinking', category: 'emoji' },
    { value: '😮', label: 'Surprised', category: 'emoji' },
    { value: '❤️', label: 'Heart', category: 'emoji' },
    { value: '🔥', label: 'Fire', category: 'emoji' },
    { value: '🎉', label: 'Celebrate', category: 'emoji' },
    { value: '📌', label: 'Pin', category: 'emoji' },
  ];
  const customSavedSymbols = [...new Set([...recentSymbols, ...favoriteSymbols])]
    .filter(value => !symbols.some(item => item.value === value))
    .map(value => ({ value, label: `Custom ${value}`, category: 'emoji' }));
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
  const glassPanelClass = "absolute top-full mt-2 left-1/2 -translate-x-1/2 p-3 rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-slate-800/95 border border-white/50 dark:border-slate-600/50 shadow-2xl ring-1 ring-black/5 flex flex-wrap gap-2 min-w-[180px] justify-center z-50";

  return (
    <div ref={toolbarRef} className="w-full bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-2 py-1 flex flex-wrap items-center gap-1.5 shadow-sm z-50 sticky top-0 transition-colors min-h-12 overflow-visible">
      
      {/* Tools Group */}
      <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg gap-0.5 shrink-0">
        
        {/* Render Select, Hand, Crop, Eraser first */}
        {mainTools.slice(0, 4).map((t) => (
          <button
            key={t.id}
            onClick={() => selectTool(t.id as ToolType)}
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
                className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                isDrawActive
                    ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/10' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
                title={`Brush: ${activeDrawDef.label}`}
            >
                {/* Show the last used drawing tool icon */}
                {React.createElement(activeDrawDef.icon, { size: 18 })}
            </button>
            
            {openPopover === 'draw' && <div className={glassPanelClass}>
                <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300 mb-1">Brushes & Effects</div>
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
        <div className="relative">
            <button
                onClick={() => {
                  setTool(lastShape);
                  togglePopover('shape');
                }}
                aria-expanded={openPopover === 'shape'}
                className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                isShapeActive
                    ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/10' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
                title={`Shape: ${activeShapeDef.label}`}
            >
                {/* Show the last used shape icon */}
                {React.createElement(activeShapeDef.icon, { size: 18 })}
            </button>
            
            {openPopover === 'shape' && <div className={glassPanelClass}>
                <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300 mb-1">Geometric Shapes</div>
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

        {/* Render remaining direct tools */}
        {mainTools.slice(4).map((t) => (
          <button
            key={t.id}
            onClick={() => selectTool(t.id as ToolType)}
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

        <div className="relative">
          <button
            onClick={() => {
              setTool('symbol');
              togglePopover('symbols');
            }}
            aria-expanded={openPopover === 'symbols'}
            title="Icons & symbols"
            className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
              currentTool === 'symbol'
                ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/10'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <SmilePlus size={18} />
          </button>

          {openPopover === 'symbols' && (
            <div className={`${glassPanelClass} w-[340px] flex-col flex-nowrap items-stretch`}>
              <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300">Icons, symbols & Emoji</div>
              <input
                autoFocus
                value={symbolSearch}
                onChange={event => setSymbolSearch(event.target.value)}
                placeholder="Search or paste an emoji…"
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <div className="flex w-full gap-1 overflow-x-auto pb-1">
                {([
                  ['all', 'All'], ['marks', 'Marks'], ['hands', 'Hands'], ['status', 'Status'],
                  ['emoji', 'Emoji'], ['recent', 'Recent'], ['favorites', 'Saved'],
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
              <div className="grid max-h-52 w-full grid-cols-7 gap-1.5 overflow-y-auto p-0.5">
                {filteredSymbols.map(item => (
                  <div key={item.label} className="group/symbol relative">
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
                      onClick={() => toggleFavoriteSymbol(item.value)}
                      className={`absolute -right-0.5 -top-0.5 rounded-full bg-white p-0.5 shadow transition dark:bg-slate-700 ${favoriteSymbols.includes(item.value) ? 'text-amber-500 opacity-100' : 'text-slate-400 opacity-0 group-hover/symbol:opacity-100'}`}
                      title={favoriteSymbols.includes(item.value) ? 'Remove from saved' : 'Save symbol'}
                    >
                      <Star size={9} fill={favoriteSymbols.includes(item.value) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                ))}
              </div>
              {filteredSymbols.length === 0 && !canUseCustomSymbol && <p className="w-full py-4 text-center text-xs text-slate-400">No matching symbols.</p>}
              {canUseCustomSymbol && !availableSymbols.some(item => item.value === customSymbol) && (
                <button type="button" onClick={() => chooseSymbol(customSymbol)} className="w-full rounded-lg border border-dashed border-brand-300 px-3 py-2 text-xs text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-700">
                  Use custom symbol <span className="ml-2 text-lg">{customSymbol}</span>
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 shrink-0"></div>

      {/* Color Picker (Liquid Glass Popover) */}
      <div className="relative shrink-0">
          <button 
              onClick={() => togglePopover('color')}
              aria-expanded={openPopover === 'color'}
              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Color Settings"
          >
              <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-black/10" style={{ backgroundColor: settings.color }}></div>
          </button>
          
          {openPopover === 'color' && <div className={glassPanelClass}>
              <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300 mb-1">Color Palette</div>
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
                        title="Custom Color"
                    />
                </div>
          </div>}
      </div>

      {/* Each tool keeps its own remembered size. */}
      {supportsSize && <div className="relative shrink-0">
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
                        >
                            <div 
                                className="rounded-full bg-slate-800 dark:bg-slate-200" 
                                style={{ 
                                    width: Math.max(2, Math.min(20, size)), 
                                    height: Math.max(2, Math.min(20, size)) 
                                }} 
                            />
                        </button>
                        ))}
                   </div>
              )}
          </div>}
      </div>}

      {/* Contextual Inline Tools (Keep these accessible) */}
      {(contextualTool === 'arrow' || contextualTool === 'stamp' || contextualTool === 'pixelate' || contextualTool === 'highlighter') && (
        <>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 shrink-0"></div>
            
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
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">No.</span>
                        <input 
                            type="number"
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
                        title="Pixelate (Mosaic)"
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
                        title="Blur (Smooth)"
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
                        title="Freehand Brush"
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
                        title="Rectangular Area"
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
                        title="Filled Arrow"
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
                        title="Outline Arrow"
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

      <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 shrink-0"></div>

      {/* Undo/Redo/Clear Group */}
      <div className="flex gap-0.5 shrink-0">
         <button 
          onClick={onUndo} disabled={!canUndo}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"
          title="Undo"
        >
          <Undo size={16} />
        </button>
        <button 
          onClick={onRedo} disabled={!canRedo}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"
          title="Redo"
        >
          <Redo size={16} />
        </button>
        <button 
          onClick={onDeleteSelected} disabled={!hasSelection}
          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Delete Selected"
        >
          <Trash2 size={16} />
        </button>
         <button 
          onClick={onClearAll}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded hover:text-red-500 dark:hover:text-red-400"
          title="Clear Canvas"
        >
          <FileX size={16} />
        </button>
      </div>

      <div className="hidden lg:block flex-grow"></div>

      {selectionCount > 1 && (
        <div className="flex items-center gap-0.5 rounded bg-brand-50 p-0.5 text-[10px] text-brand-700 dark:bg-slate-700 dark:text-brand-300" title="Align selected objects · Shift-click to change the selection">
          <span className="px-1 font-semibold">{selectionCount} selected</span>
          {[
            ['left', 'L', 'Align left'],
            ['centerX', 'C', 'Align horizontal centers'],
            ['right', 'R', 'Align right'],
            ['top', 'T', 'Align top'],
            ['centerY', 'M', 'Align vertical centers'],
            ['bottom', 'B', 'Align bottom'],
          ].map(([action, label, title]) => (
            <button
              key={action}
              onClick={() => onAlign(action as 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom')}
              className="h-6 min-w-6 rounded bg-white px-1 font-bold shadow-sm hover:bg-brand-100 dark:bg-slate-600 dark:hover:bg-slate-500"
              title={title}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Layer Actions */}
      {hasSelection && (
         <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700 p-0.5 rounded shrink-0 hidden md:flex">
            <button onClick={() => onLayerOrder('front')} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300" title="Bring to Front">
                <BringToFront size={14} />
            </button>
             <button onClick={() => onLayerOrder('forward')} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300" title="Bring Forward">
                <ChevronUp size={14} />
            </button>
            <button onClick={() => onLayerOrder('backward')} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300" title="Send Backward">
                <ChevronDown size={14} />
            </button>
            <button onClick={() => onLayerOrder('back')} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300" title="Send to Back">
                <SendToBack size={14} />
            </button>
         </div>
      )}

      {/* Right Side Actions */}
      <div className="flex gap-1 items-center shrink-0">
        <button 
          onClick={onToggleLock} disabled={!hasSelection}
          className={`p-1.5 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${
              selectedElement?.locked 
              ? 'text-red-500 bg-red-50 dark:bg-red-900/20' 
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          title={selectedElement?.locked ? "Unlock" : "Lock"}
        >
          {selectedElement?.locked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 hidden sm:block"></div>

        <button
          onClick={onScreenCapture}
          className="flex items-center gap-1.5 px-2 py-1 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-lg font-medium text-xs transition-colors h-8"
          title="Capture Screen (Alt+S)"
        >
          <MonitorUp size={14} />
          <span className="hidden sm:inline">Capture</span>
        </button>

        <button 
          onClick={onCopy}
          className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg font-medium text-xs transition-colors h-8"
          title="Copy (Ctrl+C)"
        >
          <Copy size={14} />
          <span className="hidden sm:inline">Copy</span>
        </button>
        <button 
          onClick={onOpenFile}
          className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg font-medium text-xs transition-colors h-8"
          title="Open File"
        >
          <FolderOpen size={14} />
          <span className="hidden sm:inline">Open</span>
        </button>
        <button 
          onClick={onSave}
          className="flex items-center gap-1.5 px-2 py-1 bg-brand-600 text-white hover:bg-brand-700 rounded-lg font-medium shadow-sm text-xs transition-colors h-8"
          title="Save Active Tab"
        >
          <Save size={14} />
          <span className="hidden sm:inline">Save</span>
        </button>
        <button 
          onClick={onSaveAll}
          className="flex items-center gap-1.5 px-2 py-1 bg-slate-700 text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 rounded-lg font-medium shadow-sm text-xs transition-colors h-8"
          title="Save All Tabs"
        >
          <Files size={14} />
          <span className="hidden sm:inline">All</span>
        </button>

        <button
          onClick={toggleDarkMode}
          className="ml-1 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
