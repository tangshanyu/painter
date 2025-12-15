import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingElement, Point, TabData, ToolType, ToolSettings } from '../types';
import { 
  renderCanvas, 
  getMousePos, 
  isPointInElement, 
  getResizeHandleType, 
  ResizeHandleType,
  getCursorForHandle
} from '../utils/draw';

interface EditorProps {
  tab: TabData;
  activeTool: ToolType;
  toolSettings: ToolSettings;
  updateTab: (id: string, updates: Partial<TabData>) => void;
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;
}

const Editor: React.FC<EditorProps> = ({ 
  tab, 
  activeTool, 
  toolSettings, 
  updateTab,
  selectedElementId,
  setSelectedElementId
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  
  // States
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Resize State
  const [resizeState, setResizeState] = useState<{
    handle: ResizeHandleType;
    startPos: Point;
    originalEl: DrawingElement;
  } | null>(null);

  const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
  const [cursor, setCursor] = useState('default');
  
  // Current drawing state (transient)
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  
  // Text Input State
  const [textInput, setTextInput] = useState<{
    id?: string; // If editing existing
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    visible: boolean;
  } | null>(null);

  // Load Background Image
  useEffect(() => {
    if (tab.imageDataUrl) {
      const img = new Image();
      img.src = tab.imageDataUrl;
      img.onload = () => {
        setBgImage(img);
        if (tab.canvasWidth === 800 && tab.canvasHeight === 600) {
             updateTab(tab.id, { canvasWidth: img.width, canvasHeight: img.height });
        }
      };
    } else {
      setBgImage(null);
    }
  }, [tab.imageDataUrl, tab.id, updateTab]); 

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = tab.canvasWidth;
    canvas.height = tab.canvasHeight;

    renderCanvas(canvas, ctx, bgImage, tab.elements, currentElement, selectedElementId, tab.scale);
  }, [tab.elements, tab.canvasWidth, tab.canvasHeight, bgImage, currentElement, selectedElementId, tab.scale]);

  // Commit Text Helper
  const commitText = useCallback(() => {
    if (!textInput || !textInput.visible) return;
    setTextInput(null);

    // Filter out the old element if we are editing an existing one
    let newElements = textInput.id 
        ? tab.elements.filter(el => el.id !== textInput.id) 
        : [...tab.elements];

    if (textInput.text.trim()) {
        const newElement: DrawingElement = {
          id: textInput.id || Date.now().toString(),
          type: 'text',
          color: toolSettings.color,
          strokeWidth: toolSettings.strokeWidth, 
          x: textInput.x,
          y: textInput.y,
          width: textInput.width,
          height: textInput.height,
          text: textInput.text
        };
        newElements.push(newElement);
        setSelectedElementId(newElement.id);
    }

    const newHistory = tab.history.slice(0, tab.historyIndex + 1);
    newHistory.push(newElements);
    updateTab(tab.id, { elements: newElements, history: newHistory, historyIndex: newHistory.length - 1 });
    
  }, [textInput, tab.elements, tab.history, tab.historyIndex, tab.id, toolSettings, updateTab, setSelectedElementId]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pos = getMousePos(canvasRef.current, e);

    // Find element
    for (let i = tab.elements.length - 1; i >= 0; i--) {
        const el = tab.elements[i];
        if (el.type === 'text' && isPointInElement(pos.x, pos.y, el, ctx)) {
            // Enter edit mode
            setTextInput({
                id: el.id,
                x: el.x || 0,
                y: el.y || 0,
                width: el.width || 0,
                height: el.height || 0,
                text: el.text || '',
                visible: true
            });
            // Deselect to hide the canvas rendering of it while editing (optional, but looks cleaner)
            setSelectedElementId(null); 
            return;
        }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // 1. If text input is open, commit it first
    if (textInput?.visible) {
      commitText();
      return; 
    }

    const pos = getMousePos(canvasRef.current, e);

    // --- PRIORITY 1: CHECK RESIZE HANDLE (IN ALL MODES) ---
    if (selectedElementId) {
        const selectedEl = tab.elements.find(el => el.id === selectedElementId);
        if (selectedEl) {
            const handle = getResizeHandleType(pos.x, pos.y, selectedEl);
            if (handle) {
                setResizeState({
                    handle,
                    startPos: pos,
                    originalEl: { ...selectedEl }
                });
                return;
            }
        }
    }

    // --- PRIORITY 2: SELECTION LOGIC ---
    const isSelectionMode = activeTool === 'select' || e.ctrlKey || e.metaKey;

    if (isSelectionMode) {
      let foundId: string | null = null;
      for (let i = tab.elements.length - 1; i >= 0; i--) {
        if (isPointInElement(pos.x, pos.y, tab.elements[i], ctx)) {
          foundId = tab.elements[i].id;
          break;
        }
      }

      setSelectedElementId(foundId);
      if (foundId) {
        setIsDragging(true);
        setDragStartPos(pos);
      }
      return;
    }

    // --- PRIORITY 3: DRAWING MODE ---
    setSelectedElementId(null);
    setIsDrawing(true);
    setDragStartPos(pos); 

    if (activeTool === 'text') {
        setCurrentElement({
            id: 'temp-text',
            type: 'text',
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            color: toolSettings.color,
            strokeWidth: toolSettings.strokeWidth,
        });
        return;
    }

    const newId = Date.now().toString();
    const startElement: DrawingElement = {
      id: newId,
      type: activeTool,
      color: toolSettings.color,
      strokeWidth: toolSettings.strokeWidth,
      points: (activeTool === 'pen' || activeTool === 'highlighter') ? [pos] : undefined,
      x: (activeTool === 'rect' || activeTool === 'arrow') ? pos.x : undefined,
      y: (activeTool === 'rect' || activeTool === 'arrow') ? pos.y : undefined,
      width: 0,
      height: 0,
    };
    setCurrentElement(startElement);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const pos = getMousePos(canvasRef.current, e);

    // --- CURSOR UPDATES ---
    if (!isDrawing && !isDragging && !resizeState) {
        // Check hover over handles
        if (selectedElementId) {
            const selectedEl = tab.elements.find(el => el.id === selectedElementId);
            if (selectedEl) {
                const handle = getResizeHandleType(pos.x, pos.y, selectedEl);
                if (handle) {
                    setCursor(getCursorForHandle(handle));
                } else {
                     setCursor(activeTool === 'select' ? 'default' : 'crosshair');
                }
            }
        } else {
            setCursor(activeTool === 'select' ? 'default' : 'crosshair');
        }
    }

    // --- RESIZING (8-Way) ---
    if (resizeState) {
        const { handle, startPos, originalEl } = resizeState;
        const dx = pos.x - startPos.x;
        const dy = pos.y - startPos.y;
        
        const newEl = { ...originalEl };
        let ox = originalEl.x || 0;
        let oy = originalEl.y || 0;
        let ow = originalEl.width || 0;
        let oh = originalEl.height || 0;

        // Apply changes based on handle
        if (handle.includes('e')) newEl.width = ow + dx;
        if (handle.includes('s')) newEl.height = oh + dy;
        if (handle.includes('w')) {
            newEl.x = ox + dx;
            newEl.width = ow - dx;
        }
        if (handle.includes('n')) {
            newEl.y = oy + dy;
            newEl.height = oh - dy;
        }

        const updatedElements = tab.elements.map(el => el.id === originalEl.id ? newEl : el);
        updateTab(tab.id, { elements: updatedElements });
        return;
    }

    // --- DRAGGING ---
    if (isDragging && selectedElementId && dragStartPos) {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;

      const updatedElements = tab.elements.map(el => {
        if (el.id !== selectedElementId) return el;
        const newEl = { ...el };
        if (['rect', 'image', 'text', 'arrow'].includes(newEl.type)) {
          newEl.x = (el.x || 0) + dx;
          newEl.y = (el.y || 0) + dy;
        } else if ((newEl.type === 'pen' || newEl.type === 'highlighter') && newEl.points) {
          newEl.points = newEl.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        }
        return newEl;
      });
      updateTab(tab.id, { elements: updatedElements });
      setDragStartPos(pos);
      return;
    }

    // --- DRAWING ---
    if (!isDrawing || !currentElement || !dragStartPos) return;

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      let nextPoint = pos;
      if (activeTool === 'highlighter' && e.shiftKey) {
          nextPoint = { x: pos.x, y: dragStartPos.y };
      }
      const newPoints = [...(currentElement.points || []), nextPoint];
      setCurrentElement({ ...currentElement, points: newPoints });

    } else if (activeTool === 'rect' || activeTool === 'text' || activeTool === 'arrow') {
      const w = pos.x - dragStartPos.x;
      const h = pos.y - dragStartPos.y;
      setCurrentElement({ 
          ...currentElement, 
          width: w, 
          height: h,
          x: dragStartPos.x, 
          y: dragStartPos.y
      });
    }
  };

  const handleMouseUp = () => {
    // Finish Resize or Drag
    if (resizeState) {
        setResizeState(null);
        // Save history
        const newHistory = tab.history.slice(0, tab.historyIndex + 1);
        newHistory.push(tab.elements);
        updateTab(tab.id, { history: newHistory, historyIndex: newHistory.length - 1 });
        return;
    }

    if (isDragging) {
      setIsDragging(false);
      setDragStartPos(null);
      const newHistory = tab.history.slice(0, tab.historyIndex + 1);
      newHistory.push(tab.elements);
      updateTab(tab.id, { history: newHistory, historyIndex: newHistory.length - 1 });
      return;
    }

    // Finish Drawing
    if (!isDrawing || !currentElement) return;
    setIsDrawing(false);

    // Special Case: Text Tool - Open Input
    if (activeTool === 'text') {
        const w = currentElement.width || 0;
        const h = currentElement.height || 0;
        const finalX = w < 0 ? (currentElement.x || 0) + w : (currentElement.x || 0);
        const finalY = h < 0 ? (currentElement.y || 0) + h : (currentElement.y || 0);
        const finalW = Math.abs(w);
        const finalH = Math.abs(h);

        if (finalW < 10 || finalH < 10) {
            setCurrentElement(null); 
            return;
        }

        setTextInput({
            x: finalX,
            y: finalY,
            width: finalW,
            height: finalH,
            text: '',
            visible: true
        });
        setCurrentElement(null);
        return;
    }
    
    // Ignore tiny elements (rect/arrow)
    if ((currentElement.type === 'rect' || currentElement.type === 'arrow') && (Math.abs(currentElement.width || 0) < 5 || Math.abs(currentElement.height || 0) < 5)) {
        setCurrentElement(null);
        return;
    }

    // Normalize Rect if drawn backwards (but NOT arrow, arrow depends on direction)
    let finalElement = { ...currentElement };
    if (finalElement.type === 'rect') {
        const w = finalElement.width || 0;
        const h = finalElement.height || 0;
        if (w < 0) { finalElement.x = (finalElement.x || 0) + w; finalElement.width = Math.abs(w); }
        if (h < 0) { finalElement.y = (finalElement.y || 0) + h; finalElement.height = Math.abs(h); }
    }

    const newElements = [...tab.elements, finalElement];
    const newHistory = tab.history.slice(0, tab.historyIndex + 1);
    newHistory.push(newElements);
    updateTab(tab.id, { elements: newElements, history: newHistory, historyIndex: newHistory.length - 1 });
    setCurrentElement(null);
    setSelectedElementId(finalElement.id); // Auto-select created element
  };

  return (
    <div 
      ref={containerRef} 
      className="flex-1 bg-slate-200 overflow-auto flex items-center justify-center p-8 relative"
      onDragOver={(e) => e.preventDefault()}
    >
      <div 
        className="relative bg-white shadow-lg shadow-slate-400/50"
        style={{ 
          width: tab.canvasWidth * tab.scale, 
          height: tab.canvasHeight * tab.scale,
          // Using strict dimensions ensures scrollbars appear on the parent when zoomed
          minWidth: tab.canvasWidth * tab.scale,
          minHeight: tab.canvasHeight * tab.scale,
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          style={{ 
            cursor, 
            width: '100%', 
            height: '100%' 
          }}
          className="block"
        />

        {textInput && textInput.visible && (
          <textarea
            autoFocus
            value={textInput.text}
            onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
            onBlur={commitText}
            onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 commitText();
               }
               if (e.key === 'Escape') setTextInput(null);
            }}
            style={{
              position: 'absolute',
              left: textInput.x * tab.scale,
              top: textInput.y * tab.scale,
              width: textInput.width * tab.scale,
              height: textInput.height * tab.scale,
              fontSize: `${toolSettings.strokeWidth * 6 * tab.scale}px`,
              fontFamily: 'sans-serif',
              lineHeight: '1.2',
              color: toolSettings.color,
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px dashed #3b82f6',
              outline: 'none',
              overflow: 'hidden',
              resize: 'none',
              padding: '0',
              zIndex: 50,
            }}
            placeholder="Type here..."
          />
        )}
      </div>
    </div>
  );
};

export default Editor;