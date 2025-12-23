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
  Palette,
  Circle,
  FileX,
  Shapes,
  Diamond,
  Minus,
  Droplets,
  Brush,
  Ban
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
  
  // Tools that appear directly on the bar
  const mainTools = [
    { id: 'select', icon: MousePointer2, label: 'Select' }, 
    { id: 'crop', icon: Crop, label: 'Crop Tool' },
    { id: 'eraser', icon: Eraser, label: 'Area Eraser' },
    { id: 'pixelate', icon: Grid3X3, label: 'Mosaic / Blur' }, 
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
    // Shapes moved to separate group
    { id: 'arrow', icon: MoveUpRight, label: 'Arrow' },
    { id: 'stamp', icon: Stamp, label: 'Stamp' },
    { id: 'text', icon: Type, label: 'Text' },
  ] as const;

  const shapeTools = [
      { id: 'rect', icon: Square, label: 'Rectangle' },
      { id: 'circle', icon: Circle, label: 'Circle' },
      { id: 'triangle', icon: Triangle, label: 'Triangle' },
      { id: 'diamond', icon: Diamond, label: 'Diamond' },
      { id: 'line', icon: Minus, label: 'Line' },
  ] as const;

  const isShapeActive = shapeTools.some(t => t.id === currentTool);
  const activeShapeIcon = shapeTools.find(t => t.id === currentTool)?.icon || Shapes;

  const DOT_SIZES = [2, 4, 8, 12, 20];
  
  const TEXT_SIZES = [
      { label: '12px', value: 2 },
      { label: '18px', value: 3 },
      { label: '24px', value: 4 },
      { label: '36px', value: 6 },
      { label: '48px', value: 8 },
      { label: '72px', value: 12 },
  ];

  // Glass panel style
  const glassPanelClass = "absolute top-full mt-3 left-1/2 -translate-x-1/2 p-3 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/80 border border-white/50 dark:border-slate-600/50 shadow-2xl ring-1 ring-black/5 flex flex-wrap gap-2 min-w-[180px] justify-center z-50 transition-all duration-300 transform origin-top scale-90 opacity-0 invisible group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 translate-y-2";

  return (
    <div className="w-full bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-1 flex items-center gap-1.5 shadow-sm z-50 sticky top-0 transition-colors h-12 overflow-visible">
      
      {/* Tools Group */}
      <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg gap-0.5 shrink-0">
        {mainTools.map((t) => (
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

        {/* Shapes Group */}
        <div className="relative group">
            <button
                className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                isShapeActive
                    ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400 ring-1 ring-black/5 dark:ring-white/10' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
                title="Shapes"
            >
                {/* Dynamically show the selected shape icon or default to Shapes */}
                {React.createElement(activeShapeIcon, { size: 18 })}
            </button>
            
            <div className={glassPanelClass}>
                <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300 mb-1">Geometric Shapes</div>
                <div className="flex items-center gap-2">
                    {shapeTools.map((t) => (
                         <button
                            key={t.id}
                            onClick={() => setTool(t.id as ToolType)}
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
            </div>
        </div>

      </div>

      <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 shrink-0"></div>

      {/* Color Picker (Liquid Glass Popover) */}
      <div className="relative group shrink-0">
          <button 
              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Color Settings"
          >
              <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-black/10" style={{ backgroundColor: settings.color }}></div>
          </button>
          
          <div className={glassPanelClass}>
              <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300 mb-1">Color Palette</div>
               {COLORS.map((c) => (
                <button
                    key={c}
                    onClick={() => setSettings({ ...settings, color: c })}
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
          </div>
      </div>

      {/* Size Picker (Liquid Glass Popover) */}
      <div className="relative group shrink-0">
          <button 
              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
              title="Size / Stroke Width"
          >
             {currentTool === 'text' ? (
                 <Type size={16} />
             ) : (
                <div 
                    className="rounded-full bg-slate-800 dark:bg-slate-200" 
                    style={{ 
                        width: Math.max(4, Math.min(14, settings.strokeWidth)), 
                        height: Math.max(4, Math.min(14, settings.strokeWidth)) 
                    }} 
                />
             )}
          </button>

          <div className={glassPanelClass}>
              <div className="w-full text-xs text-center font-medium text-slate-500 dark:text-slate-300 mb-1">
                  {currentTool === 'text' ? 'Font Size' : 'Stroke Width'}
              </div>
              
              {currentTool === 'text' ? (
                   <div className="flex flex-col gap-1 w-full">
                       {TEXT_SIZES.map(s => (
                           <button
                                key={s.value}
                                onClick={() => setSettings({ ...settings, strokeWidth: s.value })}
                                className={`px-2 py-1 text-xs rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-left ${
                                    settings.strokeWidth === s.value ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-bold' : 'text-slate-700 dark:text-slate-200'
                                }`}
                           >
                               {s.label}
                           </button>
                       ))}
                   </div>
              ) : (
                   <div className="flex items-center gap-2">
                       {DOT_SIZES.map((size) => (
                        <button
                            key={size}
                            onClick={() => setSettings({ ...settings, strokeWidth: size })}
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
          </div>
      </div>

      {/* Contextual Inline Tools (Keep these accessible) */}
      {(currentTool === 'arrow' || currentTool === 'stamp' || currentTool === 'pixelate' || currentTool === 'highlighter') && (
        <>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 shrink-0"></div>
            
            {currentTool === 'stamp' && (
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 p-0.5 rounded-md">
                     <div className="flex bg-slate-200 dark:bg-slate-600 rounded p-0.5 gap-0.5">
                        <button
                            onClick={() => setSettings({ ...settings, stampStyle: 'circle' })}
                            className={`p-1 rounded ${settings.stampStyle === 'circle' ? 'bg-white dark:bg-slate-500 shadow text-brand-600' : 'text-slate-500'}`}
                            title="Circle Stamp"
                        >
                            <Circle size={14} />
                        </button>
                        <button
                            onClick={() => setSettings({ ...settings, stampStyle: 'square' })}
                            className={`p-1 rounded ${settings.stampStyle === 'square' ? 'bg-white dark:bg-slate-500 shadow text-brand-600' : 'text-slate-500'}`}
                            title="Square Stamp"
                        >
                            <Square size={14} />
                        </button>
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

            {currentTool === 'pixelate' && (
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

            {currentTool === 'highlighter' && (
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

            {currentTool === 'arrow' && (
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

      <div className="flex-grow"></div>

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
          onClick={onCopy}
          className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg font-medium text-xs transition-colors h-8"
          title="Copy (Ctrl+C)"
        >
          <Copy size={14} />
          <span className="hidden sm:inline">Copy</span>
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