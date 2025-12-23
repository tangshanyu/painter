import React, { useState, useEffect, useCallback } from 'react';
import { Minus, Plus, Maximize } from 'lucide-react';
import TabList from './components/TabList';
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import { TabData, ToolType, ToolSettings, DrawingElement } from './types';
import { DEFAULT_TOOL_SETTINGS } from './constants';
import { blobToDataURL, renderCanvas } from './utils/draw';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

function App() {
  const [tabCounter, setTabCounter] = useState(1);
  const [darkMode, setDarkMode] = useState(false);
  const [stampCounter, setStampCounter] = useState(1);
  const [clipboardElement, setClipboardElement] = useState<DrawingElement | null>(null);
  
  const [tabs, setTabs] = useState<TabData[]>([
    {
      id: '1',
      title: 'Image_001',
      imageDataUrl: null,
      elements: [],
      history: [[]],
      historyIndex: 0,
      canvasWidth: DEFAULT_WIDTH,
      canvasHeight: DEFAULT_HEIGHT,
      scale: 1,
    }
  ]);

  useEffect(() => {
    if (darkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  useEffect(() => {
     if (tabCounter === 1 && tabs.length > 0) setTabCounter(2);
  }, []); 

  const [activeTabId, setActiveTabId] = useState<string>('1');
  
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [toolSettings, setToolSettings] = useState<ToolSettings>(DEFAULT_TOOL_SETTINGS);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const updateTab = useCallback((id: string, updates: Partial<TabData>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const handleRenameTab = (id: string, newTitle: string) => {
      updateTab(id, { title: newTitle });
  };

  const calculateFitScale = (imgW: number, imgH: number) => {
    const availableW = window.innerWidth - 48; 
    const availableH = window.innerHeight - 110; 
    if (imgW <= 0 || imgH <= 0) return 1;
    const scaleW = availableW / imgW;
    const scaleH = availableH / imgH;
    return Math.min(scaleW, scaleH, 1);
  };

  useEffect(() => {
    if (selectedElementId) {
        const el = activeTab.elements.find(e => e.id === selectedElementId);
        if (el) {
            setToolSettings(prev => ({
                ...prev,
                color: el.color,
                strokeWidth: el.strokeWidth,
                arrowStyle: el.arrowStyle || 'filled'
            }));
        }
    }
  }, [selectedElementId, activeTab.elements]);

  const handleToolSettingsChange = (newSettings: ToolSettings) => {
      setToolSettings(newSettings);
      if (selectedElementId) {
          const updatedElements = activeTab.elements.map(el => {
              if (el.id === selectedElementId) {
                  return { 
                      ...el, 
                      color: newSettings.color, 
                      strokeWidth: newSettings.strokeWidth,
                      arrowStyle: newSettings.arrowStyle
                  };
              }
              return el;
          });
          const currentEl = activeTab.elements.find(e => e.id === selectedElementId);
          if (currentEl && (
              currentEl.color !== newSettings.color || 
              currentEl.strokeWidth !== newSettings.strokeWidth ||
              currentEl.arrowStyle !== newSettings.arrowStyle
          )) {
             const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
             newHistory.push(updatedElements);
             updateTab(activeTabId, { 
                 elements: updatedElements,
                 history: newHistory,
                 historyIndex: newHistory.length - 1
             });
          }
      }
  };

  const handleToggleLock = () => {
    if (selectedElementId) {
        const updatedElements = activeTab.elements.map(el => {
            if (el.id === selectedElementId) {
                return { ...el, locked: !el.locked };
            }
            return el;
        });
        
        const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
        newHistory.push(updatedElements);
        updateTab(activeTabId, { 
            elements: updatedElements,
            history: newHistory,
            historyIndex: newHistory.length - 1
        });
    }
  };

  const handleLayerOrder = (action: 'front' | 'back' | 'forward' | 'backward') => {
      if (!selectedElementId) return;
      const index = activeTab.elements.findIndex(e => e.id === selectedElementId);
      if (index === -1) return;

      const newElements = [...activeTab.elements];
      const el = newElements[index];
      
      newElements.splice(index, 1); // remove

      if (action === 'front') {
          newElements.push(el);
      } else if (action === 'back') {
          newElements.unshift(el);
      } else if (action === 'forward') {
          const newIndex = Math.min(newElements.length, index + 1);
          newElements.splice(newIndex, 0, el);
      } else if (action === 'backward') {
          const newIndex = Math.max(0, index - 1);
          newElements.splice(newIndex, 0, el);
      }

      const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
      newHistory.push(newElements);
      updateTab(activeTabId, { 
          elements: newElements,
          history: newHistory,
          historyIndex: newHistory.length - 1
      });
  };

  const handleCrop = async (cropX: number, cropY: number, cropW: number, cropH: number) => {
      // 1. Crop Background Image if exists
      let newImageDataUrl = activeTab.imageDataUrl;
      
      if (activeTab.imageDataUrl) {
          const img = new Image();
          img.src = activeTab.imageDataUrl;
          await new Promise<void>((resolve) => { img.onload = () => resolve(); });
          
          const canvas = document.createElement('canvas');
          canvas.width = cropW;
          canvas.height = cropH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              // Draw slice of original image
              ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              newImageDataUrl = canvas.toDataURL();
          }
      }

      // 2. Shift Elements
      const newElements = activeTab.elements.map(el => {
          const copy = { ...el };
          if (copy.x !== undefined) copy.x -= cropX;
          if (copy.y !== undefined) copy.y -= cropY;
          if (copy.points) copy.points = copy.points.map(p => ({ x: p.x - cropX, y: p.y - cropY }));
          return copy;
      });

      // 3. Update Tab
      const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
      newHistory.push(newElements); // Note: History currently only tracks elements, not background/canvas size. 
      // A full history system would track the entire TabData. 
      // For this implementation, crop is somewhat destructive to canvas size history, 
      // but undo will restore ELEMENTS position relative to the NEW crop, which might look weird if we don't restore canvas size.
      // To properly support Undo for Crop, we would need to store canvasWidth/Height/ImageData in history.
      // For simplicity in this lightweight app, we will just update current state and accept Undo affects elements only.

      updateTab(activeTabId, {
          imageDataUrl: newImageDataUrl,
          canvasWidth: cropW,
          canvasHeight: cropH,
          elements: newElements,
          history: newHistory,
          historyIndex: newHistory.length - 1
      });
      
      // Reset tool
      setActiveTool('select');
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasContent = tabs.some(t => t.elements.length > 0 || t.imageDataUrl !== null);
      if (hasContent) {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tabs]);

  const createNewTab = (imgData: string | null = null, w = DEFAULT_WIDTH, h = DEFAULT_HEIGHT) => {
    const newId = Date.now().toString();
    const title = `Image_${String(tabCounter).padStart(3, '0')}`;
    setTabCounter(prev => prev + 1);
    let initialScale = 1;
    if (imgData) {
        initialScale = calculateFitScale(w, h);
    }
    const newTab: TabData = {
      id: newId,
      title: title,
      imageDataUrl: imgData,
      elements: [],
      history: [[]],
      historyIndex: 0,
      canvasWidth: w,
      canvasHeight: h,
      scale: initialScale,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
    setActiveTool('select'); 
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tabToClose = tabs.find(t => t.id === id);
    if (tabToClose && (tabToClose.elements.length > 0 || tabToClose.imageDataUrl)) {
        if (!window.confirm('This tab has unsaved changes. Close anyway?')) return;
    }
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const processImageBlob = useCallback(async (blob: Blob) => {
      const dataUrl = await blobToDataURL(blob);
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
          if (!activeTab.imageDataUrl) {
              const autoScale = calculateFitScale(img.width, img.height);
              updateTab(activeTabId, {
                  imageDataUrl: dataUrl,
                  canvasWidth: img.width,
                  canvasHeight: img.height,
                  scale: autoScale
              });
          } else {
              setActiveTool('select');
              const newElement: DrawingElement = {
                  id: Date.now().toString(),
                  type: 'image',
                  imageData: dataUrl,
                  x: 20, 
                  y: 20,
                  width: img.width,
                  height: img.height,
                  color: '#000',
                  strokeWidth: 0,
                  locked: true
              };
              const newElements = [...activeTab.elements, newElement];
              const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
              newHistory.push(newElements);
              updateTab(activeTabId, {
                  elements: newElements,
                  history: newHistory,
                  historyIndex: newHistory.length - 1
              });
              setSelectedElementId(newElement.id);
          }
      };
  }, [activeTab, activeTabId, updateTab, calculateFitScale, setSelectedElementId]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    if (clipboardElement) {
        e.preventDefault();
        const offset = 20;
        const newEl = { 
            ...clipboardElement, 
            id: Date.now().toString(),
            x: (clipboardElement.x || 0) + offset,
            y: (clipboardElement.y || 0) + offset
        };
        if (newEl.points) {
            newEl.points = newEl.points.map(p => ({ x: p.x + offset, y: p.y + offset }));
        }
        const newElements = [...activeTab.elements, newEl];
        const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
        newHistory.push(newElements);
        updateTab(activeTabId, { 
            elements: newElements,
            history: newHistory,
            historyIndex: newHistory.length - 1
        });
        setSelectedElementId(newEl.id);
        return;
    }

    e.preventDefault(); 
    if (navigator.clipboard && navigator.clipboard.read) {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                if (item.types.includes('image/png')) {
                    const blob = await item.getType('image/png');
                    processImageBlob(blob);
                    return;
                }
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    processImageBlob(blob);
                    return;
                }
            }
        } catch (err) {
            console.warn("Async clipboard read failed", err);
        }
    }
    if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    processImageBlob(blob);
                    return;
                }
            }
        }
    }
  }, [clipboardElement, processImageBlob, activeTab.elements, activeTab.history, activeTab.historyIndex, activeTabId, updateTab]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const performUndo = useCallback(() => {
    if (activeTab.historyIndex > 0) {
      const newIndex = activeTab.historyIndex - 1;
      updateTab(activeTabId, {
        historyIndex: newIndex,
        elements: activeTab.history[newIndex]
      });
      setSelectedElementId(null);
    }
  }, [activeTab, activeTabId, updateTab]);

  const performRedo = useCallback(() => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      const newIndex = activeTab.historyIndex + 1;
      updateTab(activeTabId, {
        historyIndex: newIndex,
        elements: activeTab.history[newIndex]
      });
      setSelectedElementId(null);
    }
  }, [activeTab, activeTabId, updateTab]);

  const handleDeleteSelected = useCallback(() => {
      if (selectedElementId) {
          const newElements = activeTab.elements.filter(el => el.id !== selectedElementId);
          const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
          newHistory.push(newElements);
          updateTab(activeTabId, {
              elements: newElements,
              history: newHistory,
              historyIndex: newHistory.length - 1
          });
          setSelectedElementId(null);
      }
  }, [selectedElementId, activeTab, activeTabId, updateTab]);

  const handleCopy = async () => {
      if (selectedElementId) {
          const el = activeTab.elements.find(e => e.id === selectedElementId);
          if (el) {
              setClipboardElement(el);
          }
          return;
      }
      setSelectedElementId(null);
      setClipboardElement(null); 
      setTimeout(() => {
          const canvas = document.querySelector('canvas');
          if (canvas) {
              canvas.toBlob(async (blob) => {
                  if (blob) {
                      try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                      } catch (err) {
                          console.error('Failed to copy', err);
                          alert('Failed to copy to clipboard.');
                      }
                  }
              });
          }
      }, 50);
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          const target = e.target as HTMLElement;
          const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

          if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
              if (e.shiftKey) performRedo();
              else performUndo();
              e.preventDefault();
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
              performRedo();
              e.preventDefault();
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
              if (!isInput) {
                  e.preventDefault();
                  handleCopy();
              }
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
              if (!isInput) {
                  handleDeleteSelected();
              }
          } else if (e.key === 'Escape') {
             setActiveTool('select');
             setSelectedElementId(null);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performUndo, performRedo, handleDeleteSelected, handleCopy]);

  const handleClearAll = () => {
      if (window.confirm('Clear all drawings and layers? (Background image will remain)')) {
          const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
          newHistory.push([]); 
          updateTab(activeTabId, {
              elements: [],
              history: newHistory,
              historyIndex: newHistory.length - 1
          });
          setSelectedElementId(null);
      }
  };

  const handleSave = () => {
    setSelectedElementId(null);
    setTimeout(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `${activeTab.title}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    }, 50);
  };

  const handleSaveAll = async () => {
    setSelectedElementId(null);
    const dpr = window.devicePixelRatio || 1;
    for (let i = 0; i < tabs.length; i++) {
        const t = tabs[i];
        const canvas = document.createElement('canvas');
        canvas.width = t.canvasWidth * dpr;
        canvas.height = t.canvasHeight * dpr;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        let bgImg: HTMLImageElement | null = null;
        if (t.imageDataUrl) {
            await new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => { bgImg = img; resolve(); };
                img.onerror = () => resolve(); 
                img.src = t.imageDataUrl!;
            });
        }
        renderCanvas(canvas, ctx, bgImg, t.elements, null, null, 1, dpr);
        const link = document.createElement('a');
        link.download = `${t.title}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  const setScale = (newScale: number) => {
      updateTab(activeTabId, { scale: newScale });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900 transition-colors">
      <TabList 
        tabs={tabs} 
        activeTabId={activeTabId} 
        onSwitch={(id) => { setActiveTabId(id); setSelectedElementId(null); setStampCounter(1); }} 
        onClose={closeTab}
        onAdd={() => createNewTab()}
        onRename={handleRenameTab}
      />
      
      <Toolbar 
        currentTool={activeTool}
        setTool={(t) => { setActiveTool(t); setSelectedElementId(null); }}
        settings={toolSettings}
        setSettings={handleToolSettingsChange}
        canUndo={activeTab.historyIndex > 0}
        canRedo={activeTab.historyIndex < activeTab.history.length - 1}
        hasSelection={!!selectedElementId}
        selectedElement={selectedElementId ? activeTab.elements.find(e => e.id === selectedElementId) : undefined}
        onUndo={performUndo}
        onRedo={performRedo}
        onDeleteSelected={handleDeleteSelected}
        onClearAll={handleClearAll}
        onSave={handleSave}
        onSaveAll={handleSaveAll}
        onCopy={handleCopy}
        onToggleLock={handleToggleLock}
        onLayerOrder={handleLayerOrder}
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
        stampCounter={stampCounter}
        setStampCounter={setStampCounter}
      />

      <Editor 
        key={activeTabId} 
        tab={activeTab} 
        activeTool={activeTool} 
        toolSettings={toolSettings} 
        updateTab={updateTab}
        selectedElementId={selectedElementId}
        setSelectedElementId={setSelectedElementId}
        stampCounter={stampCounter}
        onStamp={() => setStampCounter(c => c + 1)}
        onCrop={handleCrop}
      />
      
      <div className="bg-brand-50 dark:bg-slate-800 border-t border-brand-100 dark:border-slate-700 px-3 py-1 text-xs text-brand-800 dark:text-brand-300 flex justify-between items-center select-none font-medium z-10 h-7 transition-colors">
         <div className="flex gap-1 items-center">
             <input 
                type="number" 
                value={activeTab.canvasWidth} 
                onChange={(e) => updateTab(activeTabId, { canvasWidth: parseInt(e.target.value) || 100 })}
                className="w-[3.5rem] bg-transparent text-right hover:bg-white/50 dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:outline-none rounded px-0.5"
             />
             <span className="opacity-80">x</span>
             <input 
                type="number" 
                value={activeTab.canvasHeight} 
                onChange={(e) => updateTab(activeTabId, { canvasHeight: parseInt(e.target.value) || 100 })}
                className="w-[3.5rem] bg-transparent text-left hover:bg-white/50 dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:outline-none rounded px-0.5"
             />
             <span className="opacity-80 ml-1">px</span>
         </div>

         <div className="flex items-center gap-2">
            <button 
                onClick={() => setScale(calculateFitScale(activeTab.canvasWidth, activeTab.canvasHeight))}
                className="p-0.5 hover:bg-brand-100 dark:hover:bg-slate-700 rounded text-brand-700 dark:text-brand-400"
                title="Fit to Screen"
            >
                <Maximize size={12} />
            </button>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-brand-200 dark:border-slate-600 shadow-sm">
                <button 
                    onClick={() => setScale(Math.max(0.1, activeTab.scale - 0.1))}
                    className="hover:text-brand-600 dark:hover:text-brand-300 dark:text-slate-300"
                >
                    <Minus size={10} />
                </button>
                
                <input 
                    type="range" 
                    min="0.1" 
                    max="3.0" 
                    step="0.05"
                    value={activeTab.scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-brand-600 dark:accent-brand-500"
                />

                <button 
                    onClick={() => setScale(Math.min(3.0, activeTab.scale + 0.1))}
                    className="hover:text-brand-600 dark:hover:text-brand-300 dark:text-slate-300"
                >
                    <Plus size={10} />
                </button>
                
                <span className="w-8 text-right text-[10px] dark:text-slate-300">{(activeTab.scale * 100).toFixed(0)}%</span>
            </div>
         </div>

         <div className="flex gap-3 opacity-75 hidden md:flex text-[10px]">
             <span>Esc: Select</span>
             <span>Del: Delete</span>
             <span>Ctrl+C: Copy</span>
             <span>Ctrl+V: Paste</span>
         </div>
      </div>
    </div>
  );
}

export default App;