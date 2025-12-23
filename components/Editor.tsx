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
  stampCounter: number;
  onStamp: () => void;
  onCrop: (x: number, y: number, w: number, h: number) => void;
}

const Editor: React.FC<EditorProps> = ({ 
  tab, 
  activeTool, 
  toolSettings, 
  updateTab,
  selectedElementId,
  setSelectedElementId,
  stampCounter,
  onStamp,
  onCrop
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [elementResizeState, setElementResizeState] = useState<{
    handle: ResizeHandleType;
    startPos: Point;
    originalEl: DrawingElement;
  } | null>(null);
  
  const [canvasResizeState, setCanvasResizeState] = useState<{
      handle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
      startScreenPos: Point; 
      startWidth: number;
      startHeight: number;
  } | null>(null);

  const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
  const [cursor, setCursor] = useState('default');
  
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  
  const [textInput, setTextInput] = useState<{
    id?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    visible: boolean;
  } | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = tab.canvasWidth * dpr;
    canvas.height = tab.canvasHeight * dpr;
    renderCanvas(canvas, ctx, bgImage, tab.elements, currentElement, selectedElementId, tab.scale, dpr);
  }, [tab.elements, tab.canvasWidth, tab.canvasHeight, bgImage, currentElement, selectedElementId, tab.scale]);

  const commitText = useCallback(() => {
    if (!textInput || !textInput.visible) return;
    setTextInput(null);
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

    for (let i = tab.elements.length - 1; i >= 0; i--) {
        const el = tab.elements[i];
        if (el.type === 'text' && isPointInElement(pos.x, pos.y, el, ctx)) {
            setTextInput({
                id: el.id,
                x: el.x || 0,
                y: el.y || 0,
                width: el.width || 0,
                height: el.height || 0,
                text: el.text || '',
                visible: true
            });
            setSelectedElementId(null); 
            return;
        }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (textInput?.visible) {
      commitText();
      return; 
    }

    const pos = getMousePos(canvasRef.current, e);

    if (selectedElementId) {
        const selectedEl = tab.elements.find(el => el.id === selectedElementId);
        if (selectedEl && !selectedEl.locked) {
            const handle = getResizeHandleType(pos.x, pos.y, selectedEl);
            if (handle) {
                setElementResizeState({
                    handle,
                    startPos: pos,
                    originalEl: { ...selectedEl }
                });
                return;
            }
        }
    }

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
        const el = tab.elements.find(e => e.id === foundId);
        if (el && !el.locked) {
            setIsDragging(true);
            setDragStartPos(pos);
        }
      }
      return;
    }

    setSelectedElementId(null);
    setIsDrawing(true);
    setDragStartPos(pos); 

    if (activeTool === 'stamp') {
        const newElement: DrawingElement = {
            id: Date.now().toString(),
            type: 'stamp',
            x: pos.x,
            y: pos.y,
            width: 0, 
            height: 0,
            color: toolSettings.color,
            strokeWidth: toolSettings.strokeWidth,
            text: stampCounter.toString()
        };
        const newElements = [...tab.elements, newElement];
        const newHistory = tab.history.slice(0, tab.historyIndex + 1);
        newHistory.push(newElements);
        updateTab(tab.id, { elements: newElements, history: newHistory, historyIndex: newHistory.length - 1 });
        setSelectedElementId(newElement.id);
        setIsDrawing(false); 
        onStamp(); 
        return;
    }

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
      x: (activeTool === 'rect' || activeTool === 'arrow' || activeTool === 'crop' || activeTool === 'pixelate') ? pos.x : undefined,
      y: (activeTool === 'rect' || activeTool === 'arrow' || activeTool === 'crop' || activeTool === 'pixelate') ? pos.y : undefined,
      width: 0,
      height: 0,
      arrowStyle: activeTool === 'arrow' ? toolSettings.arrowStyle : undefined,
    };
    setCurrentElement(startElement);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (canvasResizeState) {
        const { handle, startScreenPos, startWidth, startHeight } = canvasResizeState;
        const dx = (e.clientX - startScreenPos.x) / tab.scale; 
        const dy = (e.clientY - startScreenPos.y) / tab.scale;
        let potentialW = startWidth;
        let potentialH = startHeight;
        
        if (handle.includes('e')) potentialW = startWidth + dx;
        if (handle.includes('w')) potentialW = startWidth - dx;
        if (handle.includes('s')) potentialH = startHeight + dy;
        if (handle.includes('n')) potentialH = startHeight - dy;

        const newW = Math.max(10, potentialW);
        const newH = Math.max(10, potentialH);

        let wDiff = 0;
        let hDiff = 0;
        if (handle.includes('w')) wDiff = newW - startWidth;
        if (handle.includes('n')) hDiff = newH - startHeight;

        if (Math.round(wDiff) !== 0 || Math.round(hDiff) !== 0) {
            const updatedElements = tab.elements.map(el => {
                const copy = { ...el };
                if (copy.x !== undefined) copy.x += wDiff;
                if (copy.y !== undefined) copy.y += hDiff;
                if (copy.points) copy.points = copy.points.map(p => ({ x: p.x + wDiff, y: p.y + hDiff }));
                return copy;
            });
            updateTab(tab.id, { 
                canvasWidth: Math.round(newW), 
                canvasHeight: Math.round(newH),
                elements: updatedElements 
            });
            setCanvasResizeState({
                ...canvasResizeState,
                startScreenPos: { x: e.clientX, y: e.clientY },
                startWidth: newW,
                startHeight: newH
            });
        } else {
            updateTab(tab.id, { 
                canvasWidth: Math.round(newW), 
                canvasHeight: Math.round(newH) 
            });
        }
        return;
    }

    if (!canvasRef.current) return;
    const pos = getMousePos(canvasRef.current, e);

    if (!isDrawing && !isDragging && !elementResizeState) {
        if (selectedElementId) {
            const selectedEl = tab.elements.find(el => el.id === selectedElementId);
            if (selectedEl && !selectedEl.locked) {
                const handle = getResizeHandleType(pos.x, pos.y, selectedEl);
                if (handle) {
                    setCursor(getCursorForHandle(handle));
                } else {
                     setCursor(activeTool === 'select' ? 'default' : 'crosshair');
                }
            } else {
                setCursor(activeTool === 'select' ? 'default' : 'crosshair');
            }
        } else {
            setCursor(activeTool === 'select' ? 'default' : 'crosshair');
        }
    }

    if (elementResizeState) {
        const { handle, startPos, originalEl } = elementResizeState;
        const dx = pos.x - startPos.x;
        const dy = pos.y - startPos.y;
        
        // ROTATION LOGIC
        if (handle === 'rotate') {
             const cx = (originalEl.x || 0) + (originalEl.width || 0) / 2;
             const cy = (originalEl.y || 0) + (originalEl.height || 0) / 2;
             
             // Initial angle of handle was -90deg (Top)
             // Angle from center to current mouse
             const currentAngle = Math.atan2(pos.y - cy, pos.x - cx);
             
             // Snap to 45 deg increments if Shift key? (Optional enhancement)
             // Default handle is at -PI/2.
             // We want rotation relative to that.
             // But actually, just setting rotation to `currentAngle + PI/2` works if we consider 0 rotation = Up
             // But standard 0 rotation = Right.
             // Our drawing logic: 0 rotation means normal upright.
             // So if mouse is at Right (0 deg), rotation should be 90 deg? 
             // If mouse is at Top (-90 deg), rotation should be 0.
             // So rotation = currentAngle - (-PI/2) = currentAngle + PI/2.
             
             let newRotation = currentAngle + Math.PI / 2;
             
             // Update
             const updatedElements = tab.elements.map(el => el.id === originalEl.id ? { ...el, rotation: newRotation } : el);
             updateTab(tab.id, { elements: updatedElements });
             return;
        }

        const newEl = { ...originalEl };
        let ox = originalEl.x || 0;
        let oy = originalEl.y || 0;
        let ow = originalEl.width || 0;
        let oh = originalEl.height || 0;
        
        const shouldMaintainRatio = originalEl.type === 'image' && ['nw', 'ne', 'sw', 'se'].includes(handle || '');
        const aspectRatio = (ow !== 0 && oh !== 0) ? Math.abs(ow / oh) : 1;

        if (shouldMaintainRatio) {
            let newW = ow;
            let newH = oh;
            if (handle === 'se') {
                newW = ow + dx;
                newH = newW / aspectRatio;
            } else if (handle === 'sw') {
                newW = ow - dx;
                newH = newW / aspectRatio;
                newEl.x = ox + dx;
            } else if (handle === 'ne') {
                newW = ow + dx;
                newH = newW / aspectRatio;
                newEl.y = oy + (oh - newH);
            } else if (handle === 'nw') {
                newW = ow - dx;
                newH = newW / aspectRatio;
                newEl.x = ox + dx;
                newEl.y = oy + (oh - newH);
            }
            newEl.width = newW;
            newEl.height = newH;
        } else {
            if (handle && handle.includes('e')) newEl.width = ow + dx;
            if (handle && handle.includes('s')) newEl.height = oh + dy;
            if (handle && handle.includes('w')) {
                newEl.x = ox + dx;
                newEl.width = ow - dx;
            }
            if (handle && handle.includes('n')) {
                newEl.y = oy + dy;
                newEl.height = oh - dy;
            }
        }
        const updatedElements = tab.elements.map(el => el.id === originalEl.id ? newEl : el);
        updateTab(tab.id, { elements: updatedElements });
        return;
    }

    if (isDragging && selectedElementId && dragStartPos) {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;
      const updatedElements = tab.elements.map(el => {
        if (el.id !== selectedElementId) return el;
        const newEl = { ...el };
        if (['rect', 'image', 'text', 'arrow', 'stamp', 'pixelate'].includes(newEl.type)) {
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

    if (!isDrawing || !currentElement || !dragStartPos) return;

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      let nextPoint = pos;
      if (activeTool === 'highlighter' && e.shiftKey) {
          nextPoint = { x: pos.x, y: dragStartPos.y };
      }
      const newPoints = [...(currentElement.points || []), nextPoint];
      setCurrentElement({ ...currentElement, points: newPoints });

    } else if (activeTool === 'rect' || activeTool === 'text' || activeTool === 'arrow' || activeTool === 'crop' || activeTool === 'pixelate') {
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
    if (canvasResizeState) {
        setCanvasResizeState(null);
        return;
    }
    if (elementResizeState) {
        setElementResizeState(null);
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
    if (!isDrawing || !currentElement) return;
    setIsDrawing(false);

    // CROP TOOL LOGIC
    if (activeTool === 'crop') {
        const w = currentElement.width || 0;
        const h = currentElement.height || 0;
        const x = currentElement.x || 0;
        const y = currentElement.y || 0;

        let finalX = w < 0 ? x + w : x;
        let finalY = h < 0 ? y + h : y;
        let finalW = Math.abs(w);
        let finalH = Math.abs(h);
        
        // Safety check
        if (finalW > 10 && finalH > 10) {
            onCrop(finalX, finalY, finalW, finalH);
        }
        setCurrentElement(null);
        return;
    }

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
    
    if ((currentElement.type === 'rect' || currentElement.type === 'arrow') && (Math.abs(currentElement.width || 0) < 5 || Math.abs(currentElement.height || 0) < 5)) {
        setCurrentElement(null);
        return;
    }

    let finalElement = { ...currentElement };
    if (['rect', 'pixelate'].includes(finalElement.type as string)) {
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
    setSelectedElementId(finalElement.id); 
  };

  const handleCanvasResizeStart = (e: React.MouseEvent, handle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se') => {
      e.preventDefault();
      e.stopPropagation();
      setCanvasResizeState({
          handle,
          startScreenPos: { x: e.clientX, y: e.clientY },
          startWidth: tab.canvasWidth,
          startHeight: tab.canvasHeight
      });
  };

  return (
    <div 
      ref={containerRef} 
      className="flex-1 bg-slate-200 dark:bg-slate-950 overflow-auto flex items-center justify-center p-8 relative transition-colors"
      onMouseMove={(e) => {
          if (canvasResizeState) handleMouseMove(e);
      }}
      onMouseUp={handleMouseUp}
      onDragOver={(e) => e.preventDefault()}
    >
      <div 
        className="relative bg-white shadow-lg shadow-slate-400/50 dark:shadow-black/50"
        style={{ 
          width: tab.canvasWidth * tab.scale, 
          height: tab.canvasHeight * tab.scale,
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

        <div className="absolute top-0 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-400 cursor-nwse-resize z-20 hover:scale-125 transition-transform"
             onMouseDown={(e) => handleCanvasResizeStart(e, 'nw')}></div>
        <div className="absolute top-0 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2 bg-white border border-slate-400 cursor-nesw-resize z-20 hover:scale-125 transition-transform"
             onMouseDown={(e) => handleCanvasResizeStart(e, 'ne')}></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 -translate-x-1/2 translate-y-1/2 bg-white border border-slate-400 cursor-nesw-resize z-20 hover:scale-125 transition-transform"
             onMouseDown={(e) => handleCanvasResizeStart(e, 'sw')}></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 translate-x-1/2 translate-y-1/2 bg-white border border-slate-400 cursor-nwse-resize z-20 hover:scale-125 transition-transform"
             onMouseDown={(e) => handleCanvasResizeStart(e, 'se')}></div>
        
        <div className="absolute top-0 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-400 cursor-ns-resize z-20 hover:scale-125 transition-transform"
             onMouseDown={(e) => handleCanvasResizeStart(e, 'n')}></div>
        <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 bg-white border border-slate-400 cursor-ns-resize z-20 hover:scale-125 transition-transform"
             onMouseDown={(e) => handleCanvasResizeStart(e, 's')}></div>
        <div className="absolute top-1/2 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-400 cursor-ew-resize z-20 hover:scale-125 transition-transform"
             onMouseDown={(e) => handleCanvasResizeStart(e, 'w')}></div>
        <div className="absolute top-1/2 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2 bg-white border border-slate-400 cursor-ew-resize z-20 hover:scale-125 transition-transform"
             onMouseDown={(e) => handleCanvasResizeStart(e, 'e')}></div>

        {textInput && textInput.visible && (
          <textarea
            autoFocus
            value={textInput.text}
            onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
            onBlur={commitText}
            onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
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