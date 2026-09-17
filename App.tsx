import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Minus, Plus, Maximize, PanelTopOpen } from 'lucide-react';
import TabList from './components/TabList';
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import ExportDialog, { ExportOptions } from './components/ExportDialog';
import CanvasSpaceDialog, { CanvasEdge } from './components/CanvasSpaceDialog';
import { TabData, ToolType, ToolSettings, DrawingElement } from './types';
import { DEFAULT_TOOL_SETTINGS } from './constants';
import { blobToDataURL, renderCanvas } from './utils/draw';
import { createDocumentSnapshot, createInitialSnapshot } from './utils/history';
import { loadWorkspace, saveWorkspace } from './utils/storage';
import { resizeCanvasDocument } from './utils/canvasResize';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

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
  const [clipboardElement, setClipboardElement] = useState<DrawingElement | null>(null);
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
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

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
        setToolSettings(saved.toolSettings);
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

  const updateTab = useCallback((id: string, updates: Partial<TabData>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

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
             newHistory.push(createDocumentSnapshot(activeTab, { elements: updatedElements }));
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
        newHistory.push(createDocumentSnapshot(activeTab, { elements: updatedElements }));
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
        newHistory.push(createDocumentSnapshot(activeTab, { elements: newElements }));
        updateTab(activeTabId, { 
            elements: newElements,
            history: newHistory,
            historyIndex: newHistory.length - 1
        });
        setSelectedElementId(newEl.id);
        return;
    }

    e.preventDefault(); 
    if (await pasteImageFromSystemClipboard()) return;
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
  }, [clipboardElement, pasteImageFromSystemClipboard, processImageBlob, activeTab.elements, activeTab.history, activeTab.historyIndex, activeTabId, updateTab]);

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
      if (selectedElementId) {
          const newElements = activeTab.elements.filter(el => el.id !== selectedElementId);
          const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
          newHistory.push(createDocumentSnapshot(activeTab, { elements: newElements }));
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
  }, [performUndo, performRedo, handleDeleteSelected, handleCopy]);

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
        onOpenFile={handleOpenFileClick}
        onScreenCapture={handleScreenCapture}
        onCopy={handleCopy}
        onToggleLock={handleToggleLock}
        onLayerOrder={handleLayerOrder}
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
        onOpenFile={handleOpenFileClick}
        onPasteImage={handlePasteImageClick}
        onScreenCapture={handleScreenCapture}
        onImageDrop={processImageBlob}
        onAddCanvasSpace={handleAddCanvasSpace}
      />
      
      <div className="bg-brand-50 dark:bg-slate-800 border-t border-brand-100 dark:border-slate-700 px-3 py-1 text-xs text-brand-800 dark:text-brand-300 flex justify-between items-center select-none font-medium z-10 h-7 transition-colors">
         <div className="flex gap-1 items-center">
             <input 
                type="number" 
                value={activeTab.canvasWidth} 
                onChange={(e) => updateTab(activeTabId, { canvasWidth: parseInt(e.target.value) || 100 })}
                onBlur={commitCanvasDimensions}
                className="w-[3.5rem] bg-transparent text-right hover:bg-white/50 dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:outline-none rounded px-0.5"
             />
             <span className="opacity-80">x</span>
             <input 
                type="number" 
                value={activeTab.canvasHeight} 
                onChange={(e) => updateTab(activeTabId, { canvasHeight: parseInt(e.target.value) || 100 })}
                onBlur={commitCanvasDimensions}
                className="w-[3.5rem] bg-transparent text-left hover:bg-white/50 dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:outline-none rounded px-0.5"
             />
             <span className="opacity-80 ml-1">px</span>
             <button
                type="button"
                onClick={() => setCanvasSpaceDialogOpen(true)}
                className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-slate-700"
                title="Add blank space around the canvas"
             >
                <PanelTopOpen size={11} /> Add space
             </button>
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

         <div className={`text-[10px] ${saveStatus === 'error' ? 'text-red-500' : 'opacity-70'}`} title="Workspace is automatically stored in this browser">
             {saveStatus === 'loading' ? 'Restoring…' : saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved locally'}
         </div>

         <div className="flex gap-3 opacity-75 hidden md:flex text-[10px]">
             <span>Esc: Select</span>
             <span>Alt+S: Capture</span>
             <span>Del: Delete</span>
             <span>Ctrl+C: Copy</span>
             <span>Ctrl+V: Paste</span>
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
