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
  Files
} from 'lucide-react';
import { ToolType, ToolSettings } from '../types';
import { COLORS, STROKE_WIDTHS } from '../constants';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (t: ToolType) => void;
  settings: ToolSettings;
  setSettings: (s: ToolSettings) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onCopy: () => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setTool,
  settings,
  setSettings,
  canUndo,
  canRedo,
  hasSelection,
  onUndo,
  onRedo,
  onSave,
  onSaveAll,
  onCopy,
  onDeleteSelected,
  onClearAll
}) => {
  
  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select' }, 
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'arrow', icon: MoveUpRight, label: 'Arrow' },
    { id: 'text', icon: Type, label: 'Text' },
  ] as const;

  return (
    <div className="w-full bg-white border-b border-slate-200 p-1 flex flex-wrap items-center gap-2 shadow-sm z-10 sticky top-0">
      
      {/* Tools Group */}
      <div className="flex bg-slate-100 p-0.5 rounded gap-0.5">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
              currentTool === t.id 
                ? 'bg-white shadow text-brand-600 ring-1 ring-black/5' 
                : 'text-slate-500 hover:bg-slate-200'
            }`}
          >
            <t.icon size={18} />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-slate-300 mx-1"></div>

      {/* Colors */}
      <div className="flex gap-1 items-center">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setSettings({ ...settings, color: c })}
            className={`w-5 h-5 rounded-full border border-slate-200 transition-transform ${
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

      <div className="w-px h-6 bg-slate-300 mx-1"></div>

      {/* Stroke Width */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500 font-medium uppercase hidden sm:inline">Size</span>
        <select 
          value={settings.strokeWidth}
          onChange={(e) => setSettings({ ...settings, strokeWidth: Number(e.target.value) })}
          className="bg-slate-50 border border-slate-300 text-slate-700 text-xs rounded focus:ring-brand-500 focus:border-brand-500 block p-1 h-7"
        >
          {STROKE_WIDTHS.map(w => (
            <option key={w} value={w}>{w}px</option>
          ))}
        </select>
      </div>

      {/* Helper Text for Highlighter */}
      {currentTool === 'highlighter' && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100 ml-1">
          <Info size={12} />
          <span>Shift: H-Line</span>
        </div>
      )}

      <div className="flex-grow"></div>

      {/* Actions */}
      <div className="flex gap-1 items-center">
         <button 
          onClick={onUndo} disabled={!canUndo}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo size={16} />
        </button>
        <button 
          onClick={onRedo} disabled={!canRedo}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
          title="Redo (Ctrl+Y)"
        >
          <Redo size={16} />
        </button>
        
        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        <button 
          onClick={onDeleteSelected} disabled={!hasSelection}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
          title="Delete Selected (Del)"
        >
          <Trash2 size={16} />
        </button>

        <button 
          onClick={onClearAll}
          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded hover:text-red-500"
          title="Clear Canvas"
        >
          <Eraser size={16} />
        </button>
        
        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        <button 
          onClick={onCopy}
          className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded font-medium text-xs transition-colors h-7"
          title="Copy to Clipboard"
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
          className="flex items-center gap-1.5 px-2 py-1 bg-slate-700 text-white hover:bg-slate-800 rounded font-medium shadow-sm text-xs transition-colors h-7"
          title="Save All Tabs"
        >
          <Files size={14} />
          <span className="hidden sm:inline">All</span>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;