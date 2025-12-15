import React, { useState, useEffect, useCallback } from 'react';
import TabList from './components/TabList';
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import { TabData, ToolType, ToolSettings, DrawingElement } from './types';
import { DEFAULT_TOOL_SETTINGS } from './constants';
import { blobToDataURL } from './utils/draw';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

function App() {
  // Global counter for sequential naming (e.g. Image_001, Image_002)
  const [tabCounter, setTabCounter] = useState(1);
  
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
  
  // Update counter after initial render so next is 002
  useEffect(() => {
     if (tabCounter === 1 && tabs.length > 0) setTabCounter(2);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeTabId, setActiveTabId] = useState<string>('1');
  
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [toolSettings, setToolSettings] = useState<ToolSettings>(DEFAULT_TOOL_SETTINGS);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const updateTab = useCallback((id: string, updates: Partial<TabData>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  // --- Sync Selection <-> Toolbar ---
  
  // When selection changes, update toolbar settings to match selected object
  useEffect(() => {
    if (selectedElementId) {
        const el = activeTab.elements.find(e => e.id === selectedElementId);
        if (el) {
            setToolSettings(prev => ({
                ...prev,
                color: el.color,
                strokeWidth: el.strokeWidth
            }));
        }
    }
  }, [selectedElementId, activeTab.elements]);

  // Handle changing settings while an element is selected
  const handleToolSettingsChange = (newSettings: ToolSettings) => {
      setToolSettings(newSettings);

      // If we have a selection, update its properties immediately
      if (selectedElementId) {
          const updatedElements = activeTab.elements.map(el => {
              if (el.id === selectedElementId) {
                  return { ...el, color: newSettings.color, strokeWidth: newSettings.strokeWidth };
              }
              return el;
          });
          
          // Only update if something actually changed to avoid loop
          const currentEl = activeTab.elements.find(e => e.id === selectedElementId);
          if (currentEl && (currentEl.color !== newSettings.color || currentEl.strokeWidth !== newSettings.strokeWidth)) {
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

  // --- Unsaved Changes Warning ---
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

  // --- Tab Management ---

  const createNewTab = (imgData: string | null = null, w = DEFAULT_WIDTH, h = DEFAULT_HEIGHT) => {
    const newId = Date.now().toString();
    const title = `Image_${String(tabCounter).padStart(3, '0')}`;
    setTabCounter(prev => prev + 1);

    const newTab: TabData = {
      id: newId,
      title: title,
      imageDataUrl: imgData,
      elements: [],
      history: [[]],
      historyIndex: 0,
      canvasWidth: w,
      canvasHeight: h,
      scale: 1,
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


  // --- Clipboard Integration ---

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
           const dataUrl = await blobToDataURL(blob);
           const img = new Image();
           img.src = dataUrl;
           img.onload = () => {
             // 1. If empty tab, set as background
             if (!activeTab.imageDataUrl && activeTab.elements.length === 0) {
                updateTab(activeTabId, {
                  imageDataUrl: dataUrl,
                  canvasWidth: img.width,
                  canvasHeight: img.height,
                  title: 'Pasted Image'
                });
             } else {
                // 2. Paste as Layer
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
                    strokeWidth: 0
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
        }
        e.preventDefault();
        break;
      }
    }
  }, [activeTab, activeTabId, updateTab, tabs]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // --- Shortcuts & Actions ---

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

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
              if (e.shiftKey) performRedo();
              else performUndo();
              e.preventDefault();
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
              performRedo();
              e.preventDefault();
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
              if ((e.target as HTMLElement).tagName !== 'TEXTAREA') {
                  handleDeleteSelected();
              }
          } else if (e.key === 'Escape') {
             // Quick switch to select tool
             setActiveTool('select');
             setSelectedElementId(null);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performUndo, performRedo, handleDeleteSelected]);

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

  const handleCopy = async () => {
      setSelectedElementId(null);
      setTimeout(() => {
          const canvas = document.querySelector('canvas');
          if (canvas) {
              canvas.toBlob(async (blob) => {
                  if (blob) {
                      try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        alert('Copied to clipboard!');
                      } catch (err) {
                          alert('Failed to copy.');
                      }
                  }
              });
          }
      }, 50);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <TabList 
        tabs={tabs} 
        activeTabId={activeTabId} 
        onSwitch={(id) => { setActiveTabId(id); setSelectedElementId(null); }} 
        onClose={closeTab}
        onAdd={() => createNewTab()}
      />
      
      <Toolbar 
        currentTool={activeTool}
        setTool={(t) => { setActiveTool(t); setSelectedElementId(null); }}
        settings={toolSettings}
        setSettings={handleToolSettingsChange}
        canUndo={activeTab.historyIndex > 0}
        canRedo={activeTab.historyIndex < activeTab.history.length - 1}
        hasSelection={!!selectedElementId}
        onUndo={performUndo}
        onRedo={performRedo}
        onDeleteSelected={handleDeleteSelected}
        onClearAll={handleClearAll}
        onSave={handleSave}
        onCopy={handleCopy}
      />

      <Editor 
        key={activeTabId} 
        tab={activeTab} 
        activeTool={activeTool} 
        toolSettings={toolSettings} 
        updateTab={updateTab}
        selectedElementId={selectedElementId}
        setSelectedElementId={setSelectedElementId}
      />
      
      {/* Footer Info */}
      <div className="bg-brand-50 border-t border-brand-100 px-4 py-1.5 text-xs text-brand-800 flex justify-between items-center select-none font-medium">
         <div className="flex gap-6 items-center">
             <span className="bg-white px-2 py-0.5 rounded border border-brand-200">{activeTab.canvasWidth} x {activeTab.canvasHeight} px</span>
             <span className="bg-white px-2 py-0.5 rounded border border-brand-200">Scale: {(activeTab.scale * 100).toFixed(0)}%</span>
         </div>
         <div className="flex gap-4 opacity-75">
             <span>Esc: Select Tool</span>
             <span>Del: Delete Selected</span>
             <span>Ctrl+Z: Undo</span>
             <span>Ctrl+V: Paste</span>
         </div>
      </div>
    </div>
  );
}

export default App;
