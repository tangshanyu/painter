import React from 'react';
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
  Info,
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
  ChevronDown
} from 'lucide-react';
import { ToolType, ToolSettings, DrawingElement } from '../types';
import { COLORS } from '../constants';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (t: ToolType) => void;
  settings: ToolSettings;
  setSettings: (s: ToolSettings) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  selectedElement?: DrawingElement; 
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onCopy: () => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  onToggleLock: () => void;
  onLayerOrder: (action: 'front' | 'back' | 'forward' | 'backward') => void;
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
  selectedElement,
  onUndo,
  onRedo,
  onSave,
  onSaveAll,
  onCopy,
  onDeleteSelected,
  onClearAll,
  onToggleLock,
  onLayerOrder,
  darkMode,
  toggleDarkMode,
  stampCounter,
  setStampCounter
}) => {
  
  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select' }, 
    { id: 'crop', icon: Crop, label: 'Crop Tool (Drag to crop)' },
    { id: 'pixelate', icon: Grid3X3, label: 'Mosaic' }, 
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'arrow', icon: MoveUpRight, label: 'Arrow' },
    { id: 'stamp', icon: Stamp, label: 'Stamp' },
    { id: 'text', icon: Type, label: 'Text' },
  ] as const;

  const DOT_SIZES = [2, 4, 8, 12, 20];
  
  const TEXT_SIZES = [
      { label: '12px', value: 2 },
      { label: '18px', value: 3 },
      { label: '24px', value: 4 },
      { label: '36px', value: 6 },
      { label: '48px', value: 8 },
      { label: '72px', value: 12 },
  ];

  return (
    <div className="w-full bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-1 flex flex-wrap items-center gap-2 shadow-sm z-10 sticky top-0 transition-colors">
      
      {/* Tools Group */}
      <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded gap-0.5">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id as ToolType)}
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
      </div>

      <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

      {/* Colors */}
      <div className="flex gap-1 items-center">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setSettings({ ...settings, color: c })}
            className={`w-5 h-5 rounded-full border border-slate-200 dark:border-slate-600 transition-transform ${
              settings.color === c ? 'ring-2 ring-brand-500 scale-110' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
        <input 
          type="color" 
          value={settings.color}
          onChange={(e) => setSettings({...settings, color: e.target.value})}
          className="w-6 h-6 p-0 border-0 rounded overflow-hidden cursor-pointer"
          title="Custom Color"
        />
      </div>

      <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

      {/* Size Control */}
      <div className="flex items-center gap-1.5 min-w-[120px]">
        {currentTool === 'text' ? (
            <div className="flex items-center gap-1">
                <Type size={14} className="text-slate-400" />
                <select 
                  value={settings.strokeWidth}
                  onChange={(e) => setSettings({ ...settings, strokeWidth: Number(e.target.value) })}
                  className="bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs rounded focus:ring-brand-500 focus:border-brand-500 block p-1 h-7 w-20"
                >
                  {TEXT_SIZES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
            </div>
        ) : (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700 p-1 rounded border border-slate-100 dark:border-slate-600">
                {DOT_SIZES.map((size) => (
                    <button
                        key={size}
                        onClick={() => setSettings({ ...settings, strokeWidth: size })}
                        className={`w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-600 ${settings.strokeWidth === size ? 'bg-slate-200 dark:bg-slate-600 ring-1 ring-slate-300 dark:ring-slate-500' : ''}`}
                        title={`${size}px`}
                    >
                        <div 
                            className="rounded-full bg-slate-700 dark:bg-slate-300" 
                            style={{ 
                                width: Math.max(2, Math.min(16, size)), 
                                height: Math.max(2, Math.min(16, size)) 
                            }} 
                        />
                    </button>
                ))}
            </div>
        )}
      </div>

      {/* Contextual Tools */}
      {currentTool === 'stamp' && (
        <>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">No.</span>
                <input 
                    type="number"
                    value={stampCounter}
                    onChange={(e) => setStampCounter(parseInt(e.target.value) || 1)}
                    className="w-12 h-7 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-slate-200"
                />
            </div>
        </>
      )}

      {currentTool === 'arrow' && (
        <>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded gap-0.5">
                <button
                    onClick={() => setSettings({ ...settings, arrowStyle: 'filled' })}
                    title="Filled Arrow"
                    className={`p-1.5 rounded-md transition-all ${
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
                    className={`p-1.5 rounded-md transition-all ${
                        settings.arrowStyle === 'outline'
                        ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                >
                     <Triangle size={14} />
                </button>
            </div>
        </>
      )}

      <div className="flex-grow"></div>

      {/* Layer Actions */}
      {hasSelection && (
         <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700 p-0.5 rounded mr-2">
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

      {/* General Actions */}
      <div className="flex gap-1 items-center">
         <button 
          onClick={onUndo} disabled={!canUndo}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo size={16} />
        </button>
        <button 
          onClick={onRedo} disabled={!canRedo}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"
          title="Redo (Ctrl+Y)"
        >
          <Redo size={16} />
        </button>
        
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>
        
        <button 
          onClick={onToggleLock} disabled={!hasSelection}
          className={`p-1.5 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${
              selectedElement?.locked 
              ? 'text-red-500 bg-red-50 dark:bg-red-900/20' 
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          title={selectedElement?.locked ? "Unlock Position" : "Lock Position"}
        >
          {selectedElement?.locked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>

        <button 
          onClick={onDeleteSelected} disabled={!hasSelection}
          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Delete Selected (Del)"
        >
          <Trash2 size={16} />
        </button>

        <button 
          onClick={onClearAll}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded hover:text-red-500 dark:hover:text-red-400"
          title="Clear Canvas"
        >
          <Eraser size={16} />
        </button>
        
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

        <button 
          onClick={onCopy}
          className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded font-medium text-xs transition-colors h-7"
          title="Copy (Ctrl+C)"
        >
          <Copy size={14} />
          <span className="hidden sm:inline">Copy</span>
        </button>
        <button 
          onClick={onSave}
          className="flex items-center gap-1.5 px-2 py-1 bg-brand-600 text-white hover:bg-brand-700 rounded font-medium shadow-sm text-xs transition-colors h-7"
          title="Save Active Tab"
        >
          <Save size={14} />
          <span className="hidden sm:inline">Save</span>
        </button>
        <button 
          onClick={onSaveAll}
          className="flex items-center gap-1.5 px-2 py-1 bg-slate-700 text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 rounded font-medium shadow-sm text-xs transition-colors h-7"
          title="Save All Tabs"
        >
          <Files size={14} />
          <span className="hidden sm:inline">All</span>
        </button>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

        <button
          onClick={toggleDarkMode}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </div>
  );
};

export default Toolbar;