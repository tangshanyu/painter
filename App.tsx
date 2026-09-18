import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Minus, Plus, Maximize, PanelTopOpen } from 'lucide-react';
import TabList from './components/TabList';
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import LayerPanel from './components/LayerPanel';
import PropertiesPanel from './components/PropertiesPanel';
import OperationHelp from './components/OperationHelp';
import './components/StatusBar.css';
import ExportDialog, { ExportOptions } from './components/ExportDialog';
import CanvasSpaceDialog, { CanvasEdge } from './components/CanvasSpaceDialog';
import { TabData, ToolType, ToolSettings, DrawingElement } from './types';
import { DEFAULT_TOOL_SETTINGS, DEFAULT_TOOL_SIZES } from './constants';
import { blobToDataURL, getElementBounds, renderCanvas } from './utils/draw';
import { createDocumentSnapshot, createInitialSnapshot } from './utils/history';
import { loadWorkspace, saveWorkspace } from './utils/storage';
import { resizeCanvasDocument } from './utils/canvasResize';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const normalizeStampSize = (size: number | undefined) => {
  const fallback = DEFAULT_TOOL_SIZES.stamp ?? 32;
  if (size === undefined) return fallback;
  return size < 20 ? (10 + size) * 2 : size;
};
const getStampDiameter = (element: DrawingElement) => element.stampSize ?? (10 + element.strokeWidth) * 2;
const INTERNAL_CLIPBOARD_MARKER = 'webpicpick://internal-elements';

// Add type definition for the global function called by Java
declare global {
  interface Window {
    handleWebviewPaste?: (base64String: string) => void;
  }
}

function App() {
  const [tabCounter, setTabCounter] = useState(1);
  const [darkMode, setDarkMode] = useState(false);
  const [stampCounter, setStampCounter] = useState(1);
  const [clipboardElements, setClipboardElements] = useState<DrawingElement[]>([]);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [canvasSpaceDialogOpen, setCanvasSpaceDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [tabs, setTabs] = useState<TabData[]>([
    {
      id: '1',
      title: 'Image_001',
      imageDataUrl: null,
      elements: [],
      history: [createInitialSnapshot(null, DEFAULT_WIDTH, DEFAULT_HEIGHT)],
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

  // --- Java WebView Integration Hook ---
  useEffect(() => {
    // Define the global function expected by the Java wrapper
    window.handleWebviewPaste = (base64String: string) => {
      try {
        // 1. Clean the Base64 string (remove data URI prefix if present)
        const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

        // 2. Convert Base64 to Blob/File
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        // Create a File object
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = new File([blob], `screenshot-${timestamp}.png`, { type: 'image/png' });

        // 3. Find the input element
        const inputElement = fileInputRef.current;
        if (inputElement) {
          // 4. Use DataTransfer to assign the file
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          inputElement.files = dataTransfer.files;

          // 5. Dispatch change event to trigger React's handleFileChange
          const event = new Event('change', { bubbles: true });
          inputElement.dispatchEvent(event);
          
          console.log("WebView paste handled successfully");
        } else {
          console.error("File input element not found");
        }
      } catch (error) {
        console.error("Error handling WebView paste:", error);
      }
    };

    // Cleanup
    return () => {
      // We generally want to keep this available, but good practice to clean up if App unmounts
      delete window.handleWebviewPaste;
    };
  }, []); // Run once on mount

  const [activeTabId, setActiveTabId] = useState<string>('1');
  
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [toolSettings, setToolSettings] = useState<ToolSettings>(DEFAULT_TOOL_SETTINGS);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const selectedElementId = selectedElementIds[selectedElementIds.length - 1] ?? null;
  const setSelectedElementId = useCallback((id: string | null) => {
    setSelectedElementIds(id ? [id] : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restoreWorkspace = async () => {
      try {
        const saved = await loadWorkspace();
        if (cancelled || !saved || saved.version !== 1 || saved.tabs.length === 0) return;
        setTabs(saved.tabs);
        setActiveTabId(saved.tabs.some(tab => tab.id === saved.activeTabId) ? saved.activeTabId : saved.tabs[0].id);
        setTabCounter(saved.tabCounter);
        setStampCounter(saved.stampCounter);
        setDarkMode(saved.darkMode);
        setToolSettings({
          ...DEFAULT_TOOL_SETTINGS,
          ...saved.toolSettings,
          toolSizes: {
            ...DEFAULT_TOOL_SIZES,
            ...(saved.toolSettings.toolSizes || {}),
            stamp: normalizeStampSize(saved.toolSettings.toolSizes?.stamp),
          },
        });
      } catch (error) {
        console.warn('Unable to restore the local workspace', error);
      } finally {
        if (!cancelled) {
          setWorkspaceReady(true);
          setSaveStatus('saved');
        }
      }
    };
    void restoreWorkspace();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!workspaceReady) return;
    setSaveStatus('saving');
    const timeoutId = window.setTimeout(async () => {
      try {
        const compactTabs = tabs.map(tab => ({
          ...tab,
          history: [createDocumentSnapshot(tab)],
          historyIndex: 0,
        }));
        await saveWorkspace({
          version: 1,
          savedAt: Date.now(),
          tabs: compactTabs,
          activeTabId,
          tabCounter,
          stampCounter,
          darkMode,
          toolSettings,
        });
        setSaveStatus('saved');
      } catch (error) {
        console.warn('Unable to save the local workspace', error);
        setSaveStatus('error');
      }
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [workspaceReady, tabs, activeTabId, tabCounter, stampCounter, darkMode, toolSettings]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const selectedElements = selectedElementIds
      .map(id => activeTab.elements.find(element => element.id === id))
      .filter((element): element is DrawingElement => Boolean(element));

  const updateTab = useCallback((id: string, updates: Partial<TabData>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const commitElements = useCallback((elements: DrawingElement[]) => {
    const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
    newHistory.push(createDocumentSnapshot(activeTab, { elements }));
    updateTab(activeTabId, {
      elements,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  }, [activeTab, activeTabId, updateTab]);

  const handleRenameTab = (id: string, newTitle: string) => {
      updateTab(id, { title: newTitle });
  };

  const calculateFitScale = useCallback((imgW: number, imgH: number) => {
    const editorViewport = document.querySelector<HTMLElement>('[data-editor-viewport]');
    const viewportRect = editorViewport?.getBoundingClientRect();
    const availableW = Math.max(100, (viewportRect?.width ?? window.innerWidth) - 64);
    const availableH = Math.max(100, (viewportRect?.height ?? (window.innerHeight - 110)) - 64);
    if (imgW <= 0 || imgH <= 0) return 1;
    const scaleW = availableW / imgW;
    const scaleH = availableH / imgH;
    return Math.min(scaleW, scaleH, 1);
  }, []);

  useEffect(() => {
    if (selectedElementId) {
        const el = activeTab.elements.find(e => e.id === selectedElementId);
        if (el) {
            setToolSettings(prev => ({
                ...prev,
                color: el.color,
                strokeWidth: el.type === 'stamp' ? getStampDiameter(el) : el.strokeWidth,
                fontSize: el.type === 'text' || el.type === 'callout' ? (el.fontSize ?? el.strokeWidth * 6) : prev.fontSize,
                arrowStyle: el.arrowStyle ?? prev.arrowStyle,
                stampStyle: el.stampStyle ?? prev.stampStyle,
                symbol: el.symbol ?? prev.symbol,
                pixelateStyle: el.pixelateStyle ?? prev.pixelateStyle,
                highlighterStyle: el.highlighterStyle ?? prev.highlighterStyle,
            }));
        }
    } else {
        setToolSettings(prev => {
            const rememberedSize = prev.toolSizes?.[activeTool] ?? DEFAULT_TOOL_SIZES[activeTool];
            if (rememberedSize === undefined) return prev;
            if (activeTool === 'text' || activeTool === 'callout') {
                return prev.fontSize === rememberedSize ? prev : { ...prev, fontSize: rememberedSize };
            }
            return prev.strokeWidth === rememberedSize ? prev : { ...prev, strokeWidth: rememberedSize };
        });
    }
  }, [selectedElementId, activeTab.elements, activeTool]);

  const handleToolSettingsChange = (newSettings: ToolSettings) => {
      const selectedElement = selectedElementId
          ? activeTab.elements.find(element => element.id === selectedElementId)
          : undefined;
      const sizeOwner = selectedElement && selectedElement.type !== 'image'
          ? selectedElement.type
          : activeTool;
      const activeToolSize = sizeOwner === 'text' || sizeOwner === 'callout' ? newSettings.fontSize : newSettings.strokeWidth;
      // Editing a selected object must not silently change the size of the next object.
      const shouldRememberSize = !selectedElement && DEFAULT_TOOL_SIZES[sizeOwner] !== undefined;
      const nextSettings = shouldRememberSize
          ? {
              ...newSettings,
              toolSizes: {
                  ...newSettings.toolSizes,
                  [sizeOwner]: activeToolSize,
              },
          }
          : newSettings;

      setToolSettings(nextSettings);
      if (selectedElementId) {
          const updatedElements = activeTab.elements.map(el => {
              if (el.id === selectedElementId) {
                  const isText = el.type === 'text' || el.type === 'callout';
                  return {
                      ...el,
                      color: nextSettings.color,
                      strokeWidth: el.type === 'callout'
                          ? Math.min(4, Math.max(2, nextSettings.fontSize / 8))
                          : isText ? Math.max(1, nextSettings.fontSize / 6) : nextSettings.strokeWidth,
                      fontSize: isText ? nextSettings.fontSize : el.fontSize,
                      stampSize: el.type === 'stamp' ? nextSettings.strokeWidth : el.stampSize,
                      arrowStyle: el.type === 'arrow' ? nextSettings.arrowStyle : el.arrowStyle,
                      stampStyle: el.type === 'stamp' ? nextSettings.stampStyle : el.stampStyle,
                      symbol: el.type === 'symbol' ? nextSettings.symbol : el.symbol,
                      pixelateStyle: el.type === 'pixelate' ? nextSettings.pixelateStyle : el.pixelateStyle,
                      highlighterStyle: el.type === 'highlighter' ? nextSettings.highlighterStyle : el.highlighterStyle,
                  };
              }
              return el;
          });
          const currentEl = activeTab.elements.find(e => e.id === selectedElementId);
          if (currentEl && (
              currentEl.color !== nextSettings.color ||
              (currentEl.type === 'text' || currentEl.type === 'callout'
                  ? (currentEl.fontSize ?? currentEl.strokeWidth * 6) !== nextSettings.fontSize
                  : currentEl.type === 'stamp'
                    ? getStampDiameter(currentEl) !== nextSettings.strokeWidth
                    : currentEl.strokeWidth !== nextSettings.strokeWidth) ||
              (currentEl.type === 'arrow' && currentEl.arrowStyle !== nextSettings.arrowStyle) ||
              (currentEl.type === 'stamp' && currentEl.stampStyle !== nextSettings.stampStyle) ||
              (currentEl.type === 'symbol' && currentEl.symbol !== nextSettings.symbol) ||
              (currentEl.type === 'pixelate' && currentEl.pixelateStyle !== nextSettings.pixelateStyle) ||
              (currentEl.type === 'highlighter' && currentEl.highlighterStyle !== nextSettings.highlighterStyle)
             )) {
             const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
             newHistory.push(createDocumentSnapshot(activeTab, { elements: updatedElements }));
             updateTab(activeTabId, { 
                 elements: updatedElements,
                 history: newHistory,
                 historyIndex: newHistory.length - 1
             });
          }
      }
  };

  const handleToolSelect = (tool: ToolType) => {
      setActiveTool(tool);
      setSelectedElementId(null);
      setToolSettings(previous => {
          const storedSize = previous.toolSizes?.[tool] ?? DEFAULT_TOOL_SIZES[tool];
          const rememberedSize = tool === 'stamp' ? normalizeStampSize(storedSize) : storedSize;
          if (rememberedSize === undefined) return previous;
          return tool === 'text' || tool === 'callout'
              ? { ...previous, fontSize: rememberedSize }
              : {
                  ...previous,
                  strokeWidth: rememberedSize,
                  toolSizes: tool === 'stamp'
                      ? { ...previous.toolSizes, stamp: rememberedSize }
                      : previous.toolSizes,
                };
      });
  };

  const handleToggleLock = () => {
    if (selectedElementIds.length > 0) {
        const allLocked = activeTab.elements
            .filter(element => selectedElementIds.includes(element.id))
            .every(element => element.locked);
        const updatedElements = activeTab.elements.map(el => {
            if (selectedElementIds.includes(el.id)) {
                return { ...el, locked: !allLocked };
            }
            return el;
        });
        
        const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
        newHistory.push(createDocumentSnapshot(activeTab, { elements: updatedElements }));
        updateTab(activeTabId, { 
            elements: updatedElements,
            history: newHistory,
            historyIndex: newHistory.length - 1
        });
    }
  };

  const handleRenameLayer = (id: string, name: string) => {
      const element = activeTab.elements.find(item => item.id === id);
      if (!element || element.name === name) return;
      commitElements(activeTab.elements.map(item => item.id === id ? { ...item, name } : item));
  };

  const handleToggleLayerVisibility = (id: string) => {
      const element = activeTab.elements.find(item => item.id === id);
      if (!element) return;
      commitElements(activeTab.elements.map(item => item.id === id ? { ...item, hidden: !item.hidden } : item));
      if (!element.hidden) setSelectedElementIds(current => current.filter(selectedId => selectedId !== id));
  };

  const handleToggleLayerLock = (id: string) => {
      const element = activeTab.elements.find(item => item.id === id);
      if (!element) return;
      commitElements(activeTab.elements.map(item => item.id === id ? { ...item, locked: !item.locked } : item));
  };

  const handleReorderLayer = (sourceId: string, targetId: string) => {
      const sourceIndex = activeTab.elements.findIndex(element => element.id === sourceId);
      const targetIndex = activeTab.elements.findIndex(element => element.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
      const elements = [...activeTab.elements];
      const [source] = elements.splice(sourceIndex, 1);
      const insertionIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      elements.splice(insertionIndex, 0, source);
      commitElements(elements);
  };

  const handleDuplicateSelected = useCallback(() => {
      if (selectedElementIds.length === 0) return;
      const timestamp = Date.now();
      const copies = activeTab.elements
          .filter(element => selectedElementIds.includes(element.id))
          .map((element, index) => ({
              ...element,
              id: `${timestamp}-${index}`,
              name: element.name ? `${element.name} copy` : undefined,
              x: element.x === undefined ? undefined : element.x + 20,
              y: element.y === undefined ? undefined : element.y + 20,
              points: element.points?.map(point => ({ x: point.x + 20, y: point.y + 20 })),
              locked: false,
          }));
      commitElements([...activeTab.elements, ...copies]);
      setSelectedElementIds(copies.map(element => element.id));
  }, [activeTab.elements, commitElements, selectedElementIds]);

  const handleGeometryChange = (id: string, values: { x?: number; y?: number; width?: number; height?: number }) => {
      const target = activeTab.elements.find(element => element.id === id);
      if (!target || target.locked) return;
      const bounds = getElementBounds(target);
      const nextX = values.x ?? bounds.x;
      const nextY = values.y ?? bounds.y;
      const nextWidth = values.width ?? bounds.w;
      const nextHeight = values.height ?? bounds.h;
      const scaleX = bounds.w > 0 ? nextWidth / bounds.w : 1;
      const scaleY = bounds.h > 0 ? nextHeight / bounds.h : 1;

      const updatedElements = activeTab.elements.map(element => {
          if (element.id !== id) return element;
          const updated = { ...element };
          if (updated.points) {
              updated.points = updated.points.map(point => ({
                  x: nextX + (point.x - bounds.x) * scaleX,
                  y: nextY + (point.y - bounds.y) * scaleY,
              }));
          } else if (updated.type === 'stamp' || updated.type === 'symbol') {
              const requestedSize = values.width ?? values.height ?? Math.max(bounds.w, bounds.h);
              updated.x = nextX + requestedSize / 2;
              updated.y = nextY + requestedSize / 2;
              if (updated.type === 'stamp') {
                  updated.stampSize = requestedSize;
                  updated.strokeWidth = requestedSize;
              } else {
                  updated.strokeWidth = Math.max(8, requestedSize);
              }
          } else {
              updated.x = nextX + ((updated.x || 0) - bounds.x) * scaleX;
              updated.y = nextY + ((updated.y || 0) - bounds.y) * scaleY;
              if (updated.width !== undefined) updated.width *= scaleX;
              if (updated.height !== undefined) updated.height *= scaleY;
          }
          return updated;
      });
      commitElements(updatedElements);
  };

  const handleSelectedStyleChange = (values: Partial<DrawingElement>) => {
      if (selectedElementIds.length === 0) return;
      const updatedElements = activeTab.elements.map(element => {
          if (!selectedElementIds.includes(element.id) || element.locked) return element;
          const updated = { ...element, ...values };
          if (element.type === 'stamp' && values.strokeWidth !== undefined) updated.stampSize = values.strokeWidth;
          if (values.fontSize !== undefined) {
              updated.strokeWidth = element.type === 'callout'
                  ? Math.min(4, Math.max(2, values.fontSize / 8))
                  : element.type === 'text' ? Math.max(1, values.fontSize / 6) : updated.strokeWidth;
          }
          return updated;
      });
      commitElements(updatedElements);
  };

  const handleSelectedStylePreview = (values: Partial<DrawingElement>) => {
      if (selectedElementIds.length === 0) return;
      const updatedElements = activeTab.elements.map(element => {
          if (!selectedElementIds.includes(element.id) || element.locked) return element;
          const updated = { ...element, ...values };
          if (element.type === 'stamp' && values.strokeWidth !== undefined) updated.stampSize = values.strokeWidth;
          return updated;
      });
      updateTab(activeTabId, { elements: updatedElements });
  };

  const commitStylePreview = () => {
      const currentSnapshot = activeTab.history[activeTab.historyIndex];
      if (JSON.stringify(currentSnapshot?.elements) === JSON.stringify(activeTab.elements)) return;
      const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
      newHistory.push(createDocumentSnapshot(activeTab));
      updateTab(activeTabId, { history: newHistory, historyIndex: newHistory.length - 1 });
  };

  const handleAlignSelection = (action: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => {
      const selectedElements = activeTab.elements.filter(element => selectedElementIds.includes(element.id));
      if (selectedElements.length < 2) return;

      const bounds = selectedElements.map(element => ({ element, bounds: getElementBounds(element) }));
      const minX = Math.min(...bounds.map(item => item.bounds.x));
      const minY = Math.min(...bounds.map(item => item.bounds.y));
      const maxX = Math.max(...bounds.map(item => item.bounds.x + item.bounds.w));
      const maxY = Math.max(...bounds.map(item => item.bounds.y + item.bounds.h));
      const groupCenterX = (minX + maxX) / 2;
      const groupCenterY = (minY + maxY) / 2;

      const updatedElements = activeTab.elements.map(element => {
          if (!selectedElementIds.includes(element.id) || element.locked) return element;
          const box = getElementBounds(element);
          let dx = 0;
          let dy = 0;
          if (action === 'left') dx = minX - box.x;
          if (action === 'centerX') dx = groupCenterX - (box.x + box.w / 2);
          if (action === 'right') dx = maxX - (box.x + box.w);
          if (action === 'top') dy = minY - box.y;
          if (action === 'centerY') dy = groupCenterY - (box.y + box.h / 2);
          if (action === 'bottom') dy = maxY - (box.y + box.h);

          const translated = { ...element };
          if (translated.points) {
              translated.points = translated.points.map(point => ({ x: point.x + dx, y: point.y + dy }));
          } else {
              translated.x = (translated.x || 0) + dx;
              translated.y = (translated.y || 0) + dy;
          }
          return translated;
      });

      const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
      newHistory.push(createDocumentSnapshot(activeTab, { elements: updatedElements }));
      updateTab(activeTabId, {
          elements: updatedElements,
          history: newHistory,
          historyIndex: newHistory.length - 1,
      });
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
      newHistory.push(createDocumentSnapshot(activeTab, { elements: newElements }));
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
      newHistory.push(createDocumentSnapshot(activeTab, {
          imageDataUrl: newImageDataUrl,
          canvasWidth: cropW,
          canvasHeight: cropH,
          elements: newElements
      }));

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
      history: [createInitialSnapshot(imgData, w, h)],
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
              const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
              newHistory.push(createDocumentSnapshot(activeTab, {
                  imageDataUrl: dataUrl,
                  canvasWidth: img.width,
                  canvasHeight: img.height
              }));
              updateTab(activeTabId, {
                  imageDataUrl: dataUrl,
                  canvasWidth: img.width,
                  canvasHeight: img.height,
                  scale: autoScale,
                  history: newHistory,
                  historyIndex: newHistory.length - 1
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
                  locked: false // Ensure new pasted images are unlocked and editable
              };
              const newElements = [...activeTab.elements, newElement];
              const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
              newHistory.push(createDocumentSnapshot(activeTab, { elements: newElements }));
              updateTab(activeTabId, {
                  elements: newElements,
                  history: newHistory,
                  historyIndex: newHistory.length - 1
              });
              setSelectedElementId(newElement.id);
          }
      };
  }, [activeTab, activeTabId, updateTab, calculateFitScale, setSelectedElementId]);

  const pasteImageFromSystemClipboard = useCallback(async (): Promise<boolean> => {
      if (!navigator.clipboard?.read) return false;
      try {
          const clipboardItems = await navigator.clipboard.read();
          for (const item of clipboardItems) {
              const imageType = item.types.find(type => type.startsWith('image/'));
              if (!imageType) continue;
              const blob = await item.getType(imageType);
              await processImageBlob(blob);
              return true;
          }
      } catch (err) {
          console.warn('Async clipboard read failed', err);
      }
      return false;
  }, [processImageBlob]);

  const handlePasteImageClick = useCallback(async () => {
      const didPaste = await pasteImageFromSystemClipboard();
      if (!didPaste) {
          alert('No image was found on the clipboard. Copy an image and try again.');
      }
  }, [pasteImageFromSystemClipboard]);

  const handleOpenFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Convert FileList to array and process all
      const fileProcs = Array.from(files).map(async (file: File) => {
        const dataUrl = await blobToDataURL(file);
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>(resolve => {
             img.onload = () => resolve();
             img.onerror = () => resolve(); // safety
        });
        return { file, dataUrl, width: img.width, height: img.height };
      });

      const loadedFiles = await Promise.all(fileProcs);

      // Check if current tab is pristine (no background, no elements, no history)
      const isClean = !activeTab.imageDataUrl && activeTab.elements.length === 0 && activeTab.history.length <= 1;

      let newTabs = [...tabs];
      let firstNewTabId: string | null = null;
      let newTabCounter = tabCounter;

      loadedFiles.forEach((item, index) => {
        const autoScale = calculateFitScale(item.width, item.height);
        // Remove extension from filename
        const cleanName = item.file.name.replace(/\.[^/.]+$/, "");

        // If it's the first file and the current tab is clean, overwrite current tab
        if (index === 0 && isClean) {
            newTabs = newTabs.map(t => t.id === activeTabId ? {
                ...t,
                title: cleanName,
                imageDataUrl: item.dataUrl,
                canvasWidth: item.width,
                canvasHeight: item.height,
                scale: autoScale,
                elements: [],
                history: [createInitialSnapshot(item.dataUrl, item.width, item.height)],
                historyIndex: 0
            } : t);
        } else {
            // Create new tab
            const newId = Date.now().toString() + index; // Ensure unique ID even in tight loop
            
            const newTab: TabData = {
                id: newId,
                title: cleanName,
                imageDataUrl: item.dataUrl,
                elements: [],
                history: [createInitialSnapshot(item.dataUrl, item.width, item.height)],
                historyIndex: 0,
                canvasWidth: item.width,
                canvasHeight: item.height,
                scale: autoScale,
            };
            newTabs.push(newTab);
            if (!firstNewTabId) firstNewTabId = newId;
            newTabCounter++;
        }
      });
      
      setTabCounter(newTabCounter);
      setTabs(newTabs);
      
      // If we created new tabs (didn't just overwrite clean tab), switch to the first new one
      if (!isClean && firstNewTabId) {
          setActiveTabId(firstNewTabId);
      }
      
      setActiveTool('select');
      // Reset value so we can select the same file again if needed
      e.target.value = '';
  };

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    e.preventDefault();

    const clipboardItems = Array.from(e.clipboardData?.items ?? []);
    const pastedImage = clipboardItems.find(item => item.type.startsWith('image/'))?.getAsFile();
    if (pastedImage) {
        await processImageBlob(pastedImage);
        return;
    }

    const clipboardText = e.clipboardData?.getData('text/plain') ?? '';
    const pasteInternalElements = () => {
      if (clipboardElements.length > 0) {
        const offset = 20;
        const timestamp = Date.now();
        const pastedElements = clipboardElements.map((element, index) => ({
            ...element,
            id: `${timestamp}-${index}`,
            x: element.x === undefined ? undefined : element.x + offset,
            y: element.y === undefined ? undefined : element.y + offset,
            points: element.points?.map(point => ({ x: point.x + offset, y: point.y + offset })),
            locked: false,
        }));
        const newElements = [...activeTab.elements, ...pastedElements];
        const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
        newHistory.push(createDocumentSnapshot(activeTab, { elements: newElements }));
        updateTab(activeTabId, { 
            elements: newElements,
            history: newHistory,
            historyIndex: newHistory.length - 1
        });
        setSelectedElementIds(pastedElements.map(element => element.id));
        return true;
      }
      return false;
    };

    if (clipboardText.startsWith(INTERNAL_CLIPBOARD_MARKER) && pasteInternalElements()) {
        return;
    }

    if (await pasteImageFromSystemClipboard()) return;
    pasteInternalElements();
  }, [clipboardElements, pasteImageFromSystemClipboard, processImageBlob, activeTab.elements, activeTab.history, activeTab.historyIndex, activeTabId, updateTab]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const performUndo = useCallback(() => {
    if (activeTab.historyIndex > 0) {
      const newIndex = activeTab.historyIndex - 1;
      const snapshot = activeTab.history[newIndex];
      updateTab(activeTabId, {
        historyIndex: newIndex,
        elements: snapshot.elements,
        imageDataUrl: snapshot.imageDataUrl,
        canvasWidth: snapshot.canvasWidth,
        canvasHeight: snapshot.canvasHeight
      });
      setSelectedElementId(null);
    }
  }, [activeTab, activeTabId, updateTab]);

  const performRedo = useCallback(() => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      const newIndex = activeTab.historyIndex + 1;
      const snapshot = activeTab.history[newIndex];
      updateTab(activeTabId, {
        historyIndex: newIndex,
        elements: snapshot.elements,
        imageDataUrl: snapshot.imageDataUrl,
        canvasWidth: snapshot.canvasWidth,
        canvasHeight: snapshot.canvasHeight
      });
      setSelectedElementId(null);
    }
  }, [activeTab, activeTabId, updateTab]);

  const handleDeleteSelected = useCallback(() => {
      if (selectedElementIds.length > 0) {
          const newElements = activeTab.elements.filter(el => !selectedElementIds.includes(el.id));
          const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
          newHistory.push(createDocumentSnapshot(activeTab, { elements: newElements }));
          updateTab(activeTabId, {
              elements: newElements,
              history: newHistory,
              historyIndex: newHistory.length - 1
          });
          setSelectedElementId(null);
      }
  }, [selectedElementIds, activeTab, activeTabId, updateTab, setSelectedElementId]);

  const handleCopy = async () => {
      if (selectedElementIds.length > 0) {
          setClipboardElements(activeTab.elements.filter(element => selectedElementIds.includes(element.id)));
          try {
              await navigator.clipboard?.writeText(`${INTERNAL_CLIPBOARD_MARKER}/${Date.now()}`);
          } catch (error) {
              console.warn('Unable to mark the internal clipboard', error);
          }
          return;
      }
      setSelectedElementId(null);
      setClipboardElements([]);
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

  // Screen Capture Logic
  const handleScreenCapture = async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                // @ts-ignore
                cursor: "always"
            },
            audio: false
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            // Wait slightly for video to actually start rendering
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0);
                    const dataUrl = canvas.toDataURL('image/png');
                    // Create new tab with captured image
                    const newId = Date.now().toString();
                    const autoScale = calculateFitScale(canvas.width, canvas.height);
                    const newTab: TabData = {
                        id: newId,
                        title: `Screen_${String(tabCounter).padStart(3, '0')}`,
                        imageDataUrl: dataUrl,
                        elements: [],
                        history: [createInitialSnapshot(dataUrl, canvas.width, canvas.height)],
                        historyIndex: 0,
                        canvasWidth: canvas.width,
                        canvasHeight: canvas.height,
                        scale: autoScale,
                    };
                    setTabCounter(prev => prev + 1);
                    setTabs(prev => [...prev, newTab]);
                    setActiveTabId(newId);
                    setActiveTool('select');
                }
                // Stop sharing immediately after capture
                stream.getTracks().forEach(track => track.stop());
            }, 100);
        };
    } catch (err) {
        console.warn("Screen capture cancelled or failed", err);
    }
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          const target = e.target as HTMLElement;
          const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

          if (!isInput && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
              if (e.shiftKey) performRedo();
              else performUndo();
              e.preventDefault();
          } else if (!isInput && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
              performRedo();
              e.preventDefault();
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
              if (!isInput) {
                  e.preventDefault();
                  handleCopy();
              }
          } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
              if (!isInput) {
                  e.preventDefault();
                  handleDuplicateSelected();
              }
          } else if ((e.altKey) && (e.key === 's' || e.key === 'S')) {
               // Alt + S for Screenshot
               e.preventDefault();
               handleScreenCapture();
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
  }, [performUndo, performRedo, handleDeleteSelected, handleCopy, handleDuplicateSelected]);

  const handleClearAll = () => {
      if (window.confirm('Clear all drawings and layers? (Background image will remain)')) {
          const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
          newHistory.push(createDocumentSnapshot(activeTab, { elements: [] }));
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
    setExportDialogOpen(true);
  };

  const renderTabForExport = async (tab: TabData, options: ExportOptions) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(tab.canvasWidth * options.scale));
    canvas.height = Math.max(1, Math.round(tab.canvasHeight * options.scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to create an export canvas');

    let bgImg: HTMLImageElement | null = null;
    if (tab.imageDataUrl) {
      bgImg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = tab.imageDataUrl!;
      });
    }
    renderCanvas(canvas, ctx, bgImg, tab.elements, null, null, 1, options.scale);
    const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return canvas.toDataURL(mimeType, options.format === 'jpeg' ? options.quality : undefined);
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async (options: ExportOptions) => {
    const dataUrl = await renderTabForExport(activeTab, options);
    const extension = options.format === 'jpeg' ? 'jpg' : 'png';
    downloadDataUrl(dataUrl, `${activeTab.title}.${extension}`);
  };

  const handleSaveAll = async () => {
    setSelectedElementId(null);
    for (let i = 0; i < tabs.length; i++) {
        const t = tabs[i];
        const dataUrl = await renderTabForExport(t, { format: 'png', scale: 1, quality: 1 });
        downloadDataUrl(dataUrl, `${t.title}.png`);
        await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  const setScale = (newScale: number) => {
      updateTab(activeTabId, { scale: newScale });
  };

  const commitCanvasDimensions = () => {
      const currentSnapshot = activeTab.history[activeTab.historyIndex];
      if (
          currentSnapshot.canvasWidth === activeTab.canvasWidth &&
          currentSnapshot.canvasHeight === activeTab.canvasHeight
      ) return;
      const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
      newHistory.push(createDocumentSnapshot(activeTab));
      updateTab(activeTabId, { history: newHistory, historyIndex: newHistory.length - 1 });
  };

  const handleAddCanvasSpace = async (edge: CanvasEdge, amount: number) => {
      const addX = edge === 'left' ? amount : 0;
      const addY = edge === 'top' ? amount : 0;
      const nextWidth = activeTab.canvasWidth + (edge === 'left' || edge === 'right' ? amount : 0);
      const nextHeight = activeTab.canvasHeight + (edge === 'top' || edge === 'bottom' ? amount : 0);
      const resized = await resizeCanvasDocument(activeTab, nextWidth, nextHeight, addX, addY);
      const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
      newHistory.push(createDocumentSnapshot(activeTab, resized));
      updateTab(activeTabId, {
          ...resized,
          scale: calculateFitScale(resized.canvasWidth, resized.canvasHeight),
          history: newHistory,
          historyIndex: newHistory.length - 1,
      });
      setSelectedElementId(null);
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
        setTool={handleToolSelect}
        settings={toolSettings}
        setSettings={handleToolSettingsChange}
        canUndo={activeTab.historyIndex > 0}
        canRedo={activeTab.historyIndex < activeTab.history.length - 1}
        hasSelection={selectedElementIds.length > 0}
        selectionCount={selectedElementIds.length}
        selectedElement={selectedElementId ? activeTab.elements.find(e => e.id === selectedElementId) : undefined}
        onUndo={performUndo}
        onRedo={performRedo}
        onDeleteSelected={handleDeleteSelected}
        onClearAll={handleClearAll}
        onSave={handleSave}
        onSaveAll={handleSaveAll}
        onOpenFile={handleOpenFileClick}
        onScreenCapture={handleScreenCapture}
        onCopy={handleCopy}
        onToggleLock={handleToggleLock}
        onLayerOrder={handleLayerOrder}
        onAlign={handleAlignSelection}
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
        stampCounter={stampCounter}
        setStampCounter={setStampCounter}
      />

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*"
        multiple
      />

      <div className="flex min-h-0 flex-1">
        <LayerPanel
          elements={activeTab.elements}
          selectedIds={selectedElementIds}
          onSelect={setSelectedElementIds}
          onRename={handleRenameLayer}
          onToggleVisibility={handleToggleLayerVisibility}
          onToggleLock={handleToggleLayerLock}
          onReorder={handleReorderLayer}
          onDuplicate={handleDuplicateSelected}
          onDelete={handleDeleteSelected}
        />

        <Editor
          key={activeTabId}
          tab={activeTab}
          activeTool={activeTool}
          toolSettings={toolSettings}
          updateTab={updateTab}
          selectedElementId={selectedElementId}
          setSelectedElementId={setSelectedElementId}
          selectedElementIds={selectedElementIds}
          setSelectedElementIds={setSelectedElementIds}
          stampCounter={stampCounter}
          onStamp={() => setStampCounter(c => c + 1)}
          onCrop={handleCrop}
          onOpenFile={handleOpenFileClick}
          onPasteImage={handlePasteImageClick}
          onScreenCapture={handleScreenCapture}
          onImageDrop={processImageBlob}
          onAddCanvasSpace={handleAddCanvasSpace}
        />

        <PropertiesPanel
          selectedElements={selectedElements}
          onGeometryChange={handleGeometryChange}
          onStyleChange={handleSelectedStyleChange}
          onStylePreview={handleSelectedStylePreview}
          onStylePreviewCommit={commitStylePreview}
          onDuplicate={handleDuplicateSelected}
          onDelete={handleDeleteSelected}
        />
      </div>
      
      <div className="editor-statusbar border-t border-brand-100 bg-brand-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
         <div className="editor-statusbar-dimensions">
             <input 
                type="number" 
                value={activeTab.canvasWidth}
                aria-label="畫布寬度"
                onChange={(e) => updateTab(activeTabId, { canvasWidth: parseInt(e.target.value) || 100 })}
                onBlur={commitCanvasDimensions}
                className="editor-statusbar-dimension bg-transparent text-right hover:bg-white/50 dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:outline-none rounded px-0.5"
             />
             <span className="opacity-80">x</span>
             <input 
                type="number" 
                value={activeTab.canvasHeight}
                aria-label="畫布高度"
                onChange={(e) => updateTab(activeTabId, { canvasHeight: parseInt(e.target.value) || 100 })}
                onBlur={commitCanvasDimensions}
                className="editor-statusbar-dimension bg-transparent text-left hover:bg-white/50 dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:outline-none rounded px-0.5"
             />
             <span className="editor-statusbar-unit opacity-80">px</span>
             <button
                type="button"
                onClick={() => setCanvasSpaceDialogOpen(true)}
                className="editor-statusbar-add inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-slate-700"
                title="Add blank space around the canvas"
                aria-label="增加畫布留白"
             >
                <PanelTopOpen size={13} /> <span className="editor-statusbar-add-label">Add space</span>
             </button>
         </div>

         <div className="editor-statusbar-zoom">
            <button 
                onClick={() => setScale(calculateFitScale(activeTab.canvasWidth, activeTab.canvasHeight))}
                className="p-0.5 hover:bg-brand-100 dark:hover:bg-slate-700 rounded text-brand-700 dark:text-brand-400"
                title="Fit to Screen"
                aria-label="縮放至符合視窗"
            >
                <Maximize size={12} />
            </button>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-brand-200 dark:border-slate-600 shadow-sm">
                <button 
                    onClick={() => setScale(Math.max(0.1, activeTab.scale - 0.1))}
                    className="hover:text-brand-600 dark:hover:text-brand-300 dark:text-slate-300"
                    aria-label="縮小"
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
                    className="editor-statusbar-zoom-slider w-20 h-1 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-brand-600 dark:accent-brand-500"
                    aria-label="畫布縮放比例"
                />

                <button 
                    onClick={() => setScale(Math.min(3.0, activeTab.scale + 0.1))}
                    className="hover:text-brand-600 dark:hover:text-brand-300 dark:text-slate-300"
                    aria-label="放大"
                >
                    <Plus size={10} />
                </button>
                
                <span className="w-8 text-right text-[10px] dark:text-slate-300">{(activeTab.scale * 100).toFixed(0)}%</span>
            </div>
         </div>

         <div className="editor-statusbar-actions">
             <div className={`editor-statusbar-save text-[11px] ${saveStatus === 'error' ? 'text-red-500' : 'opacity-70'}`} title="Workspace is automatically stored in this browser">
                 {saveStatus === 'loading' ? 'Restoring…' : saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved locally'}
             </div>
             <OperationHelp />
         </div>
      </div>

      <ExportDialog
        isOpen={exportDialogOpen}
        title={activeTab.title}
        width={activeTab.canvasWidth}
        height={activeTab.canvasHeight}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
      />
      <CanvasSpaceDialog
        isOpen={canvasSpaceDialogOpen}
        onClose={() => setCanvasSpaceDialogOpen(false)}
        onApply={handleAddCanvasSpace}
      />
    </div>
  );
}

export default App;
