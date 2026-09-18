import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ClipboardPaste, FolderOpen, ImagePlus, MonitorUp, Plus } from 'lucide-react';
import { DrawingElement, Point, TabData, ToolType, ToolSettings } from '../types';
import type { CanvasEdge } from './CanvasSpaceDialog';
import { 
  renderCanvas, 
  getMousePos, 
  isPointInElement, 
  getResizeHandleType, 
  ResizeHandleType,
  getCursorForHandle,
  getElementBounds
} from '../utils/draw';
import { createDocumentSnapshot } from '../utils/history';
import { resizeCanvasDocument } from '../utils/canvasResize';

interface EditorProps {
  tab: TabData;
  activeTool: ToolType;
  toolSettings: ToolSettings;
  updateTab: (id: string, updates: Partial<TabData>) => void;
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;
  selectedElementIds: string[];
  setSelectedElementIds: (ids: string[]) => void;
  stampCounter: number;
  onStamp: () => void;
  onCrop: (x: number, y: number, w: number, h: number) => void;
  onOpenFile: () => void;
  onPasteImage: () => void | Promise<void>;
  onScreenCapture: () => void;
  onImageDrop: (blob: Blob) => void | Promise<void>;
  onAddCanvasSpace: (edge: CanvasEdge, amount: number) => void | Promise<void>;
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const getGroupBounds = (elements: DrawingElement[]): Bounds | null => {
  if (elements.length === 0) return null;
  const boxes = elements.map(getElementBounds);
  const left = Math.min(...boxes.map(box => box.x));
  const top = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.w));
  const bottom = Math.max(...boxes.map(box => box.y + box.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
};

const getGroupHandle = (x: number, y: number, bounds: Bounds): ResizeHandleType => {
  const padding = 6;
  const hitSize = 14;
  const half = hitSize / 2;
  const left = bounds.x - padding;
  const right = bounds.x + bounds.w + padding;
  const top = bounds.y - padding;
  const bottom = bounds.y + bounds.h + padding;
  const midX = bounds.x + bounds.w / 2;
  const midY = bounds.y + bounds.h / 2;
  const hit = (hx: number, hy: number) => x >= hx - half && x <= hx + half && y >= hy - half && y <= hy + half;
  if (hit(left, top)) return 'nw';
  if (hit(midX, top)) return 'n';
  if (hit(right, top)) return 'ne';
  if (hit(right, midY)) return 'e';
  if (hit(right, bottom)) return 'se';
  if (hit(midX, bottom)) return 's';
  if (hit(left, bottom)) return 'sw';
  if (hit(left, midY)) return 'w';
  if (hit(midX, top - 22)) return 'rotate';
  return null;
};

const rotatePoint = (point: Point, center: Point, angle: number): Point => {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
};

const Editor: React.FC<EditorProps> = ({ 
  tab, 
  activeTool, 
  toolSettings, 
  updateTab,
  selectedElementId,
  setSelectedElementId,
  selectedElementIds,
  setSelectedElementIds,
  stampCounter,
  onStamp,
  onCrop,
  onOpenFile,
  onPasteImage,
  onScreenCapture,
  onImageDrop,
  onAddCanvasSpace
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [marquee, setMarquee] = useState<{ start: Point; current: Point } | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] });
  const [panState, setPanState] = useState<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  
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
      previewWidth: number;
      previewHeight: number;
      offsetX: number;
      offsetY: number;
  } | null>(null);
  const [groupTransformState, setGroupTransformState] = useState<{
    handle: ResizeHandleType;
    startPos: Point;
    bounds: Bounds;
    originalElements: DrawingElement[];
    startAngle: number;
  } | null>(null);
  const resizeCommitRef = useRef(false);

  const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
  const [cursor, setCursor] = useState('default');
  
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [addingSpaceEdge, setAddingSpaceEdge] = useState<CanvasEdge | null>(null);
  
  const [textInput, setTextInput] = useState<{
    id?: string;
    originalElement?: DrawingElement;
    elementType: 'text' | 'callout';
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    color: string;
    fontSize: number;
    opacity: number;
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
    renderCanvas(canvas, ctx, bgImage, tab.elements, currentElement, selectedElementIds, tab.scale, dpr);

    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ec4899';
    snapGuides.vertical.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, tab.canvasHeight);
      ctx.stroke();
    });
    snapGuides.horizontal.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tab.canvasWidth, y);
      ctx.stroke();
    });

    if (marquee) {
      const x = Math.min(marquee.start.x, marquee.current.x);
      const y = Math.min(marquee.start.y, marquee.current.y);
      const width = Math.abs(marquee.current.x - marquee.start.x);
      const height = Math.abs(marquee.current.y - marquee.start.y);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.strokeStyle = '#3b82f6';
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
    }
    ctx.restore();
  }, [tab.elements, tab.canvasWidth, tab.canvasHeight, bgImage, currentElement, selectedElementIds, tab.scale, marquee, snapGuides]);

  const commitText = useCallback(() => {
    if (!textInput || !textInput.visible) return;
    setTextInput(null);
    let newElements = textInput.id ? tab.elements.filter(el => el.id !== textInput.id) : [...tab.elements];

    if (textInput.text.trim()) {
        const newElement: DrawingElement = {
          ...textInput.originalElement,
          id: textInput.id || Date.now().toString(),
          type: textInput.elementType,
          color: textInput.color,
          opacity: textInput.opacity,
          strokeWidth: textInput.elementType === 'callout'
            ? Math.min(4, Math.max(2, textInput.fontSize / 8))
            : Math.max(1, textInput.fontSize / 6),
          fontSize: textInput.fontSize,
          x: textInput.x,
          y: textInput.y,
          width: textInput.width,
          height: textInput.height,
          text: textInput.text
        };
        newElements = textInput.id
          ? tab.elements.map(element => element.id === textInput.id ? newElement : element)
          : [...tab.elements, newElement];
        setSelectedElementId(newElement.id);
    }
    const newHistory = tab.history.slice(0, tab.historyIndex + 1);
    newHistory.push(createDocumentSnapshot(tab, { elements: newElements }));
    updateTab(tab.id, { elements: newElements, history: newHistory, historyIndex: newHistory.length - 1 });
  }, [textInput, tab.elements, tab.history, tab.historyIndex, tab.id, updateTab, setSelectedElementId]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pos = getMousePos(canvasRef.current, e);

    for (let i = tab.elements.length - 1; i >= 0; i--) {
        const el = tab.elements[i];
        if ((el.type === 'text' || el.type === 'callout') && isPointInElement(pos.x, pos.y, el, ctx)) {
            setTextInput({
                id: el.id,
                originalElement: el,
                elementType: el.type,
                x: el.x || 0,
                y: el.y || 0,
                width: el.width || 0,
                height: el.height || 0,
                text: el.text || '',
                color: el.color,
                fontSize: el.fontSize ?? el.strokeWidth * 6,
                opacity: el.opacity ?? 1,
                visible: true
            });
            setSelectedElementId(null); 
            return;
        }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    if (activeTool === 'hand') return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (textInput?.visible) {
      commitText();
      return; 
    }

    const pos = getMousePos(canvasRef.current, e);

    if (!e.shiftKey && selectedElementIds.length === 1 && selectedElementId) {
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
            if (isPointInElement(pos.x, pos.y, selectedEl, ctx)) {
                setIsDragging(true);
                setDragStartPos(pos);
                setCursor('grabbing');
                return;
            }
        }
    }

    if (!e.shiftKey && selectedElementIds.length > 1) {
        const groupElements = tab.elements.filter(element => selectedElementIds.includes(element.id) && !element.hidden);
        const groupBounds = getGroupBounds(groupElements);
        if (groupBounds && groupElements.every(element => !element.locked)) {
            const handle = getGroupHandle(pos.x, pos.y, groupBounds);
            if (handle) {
                const center = { x: groupBounds.x + groupBounds.w / 2, y: groupBounds.y + groupBounds.h / 2 };
                setGroupTransformState({
                    handle,
                    startPos: pos,
                    bounds: groupBounds,
                    originalElements: groupElements.map(element => ({ ...element, points: element.points?.map(point => ({ ...point })) })),
                    startAngle: Math.atan2(pos.y - center.y, pos.x - center.x),
                });
                return;
            }
        }
        const selectedHit = [...tab.elements].reverse().find(element =>
            selectedElementIds.includes(element.id) &&
            !element.locked &&
            isPointInElement(pos.x, pos.y, element, ctx)
        );
        if (selectedHit) {
            setIsDragging(true);
            setDragStartPos(pos);
            setCursor('grabbing');
            return;
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

      if (e.shiftKey) {
        if (foundId) {
          const nextSelection = selectedElementIds.includes(foundId)
            ? selectedElementIds.filter(id => id !== foundId)
            : [...selectedElementIds, foundId];
          setSelectedElementIds(nextSelection);
        }
        return;
      }

      if (!foundId) {
        setSelectedElementId(null);
        setMarquee({ start: pos, current: pos });
        return;
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
        const storedStampSize = toolSettings.toolSizes.stamp ?? 32;
        const stampSize = storedStampSize < 20 ? (10 + storedStampSize) * 2 : storedStampSize;
        const newElement: DrawingElement = {
            id: Date.now().toString(),
            type: 'stamp',
            x: pos.x,
            y: pos.y,
            width: 0, 
            height: 0,
            color: toolSettings.color,
            opacity: toolSettings.opacity,
            strokeWidth: stampSize,
            stampSize,
            stampStyle: toolSettings.stampStyle,
            text: stampCounter.toString()
        };
        const newElements = [...tab.elements, newElement];
        const newHistory = tab.history.slice(0, tab.historyIndex + 1);
        newHistory.push(createDocumentSnapshot(tab, { elements: newElements }));
        updateTab(tab.id, { elements: newElements, history: newHistory, historyIndex: newHistory.length - 1 });
        setSelectedElementId(newElement.id);
        setIsDrawing(false); 
        onStamp(); 
        return;
    }

    if (activeTool === 'symbol') {
        const symbolSize = toolSettings.toolSizes.symbol ?? 48;
        const newElement: DrawingElement = {
            id: Date.now().toString(),
            type: 'symbol',
            x: pos.x,
            y: pos.y,
            color: toolSettings.color,
            opacity: toolSettings.opacity,
            strokeWidth: symbolSize,
            symbol: toolSettings.symbol,
        };
        const newElements = [...tab.elements, newElement];
        const newHistory = tab.history.slice(0, tab.historyIndex + 1);
        newHistory.push(createDocumentSnapshot(tab, { elements: newElements }));
        updateTab(tab.id, { elements: newElements, history: newHistory, historyIndex: newHistory.length - 1 });
        setSelectedElementId(newElement.id);
        setIsDrawing(false);
        return;
    }

    if (activeTool === 'text' || activeTool === 'callout') {
        setCurrentElement({
            id: `temp-${activeTool}`,
            type: activeTool,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            color: toolSettings.color,
            opacity: toolSettings.opacity,
            strokeWidth: activeTool === 'callout'
              ? Math.min(4, Math.max(2, toolSettings.fontSize / 8))
              : Math.max(1, toolSettings.fontSize / 6),
            fontSize: toolSettings.fontSize,
        });
        return;
    }

    // Determine if we should use point-based drawing (pen) or box-based drawing (rect/shapes)
    const isFreehand = activeTool === 'pen' || (activeTool === 'highlighter' && toolSettings.highlighterStyle === 'brush');
    
    const newId = Date.now().toString();
    const startElement: DrawingElement = {
      id: newId,
      type: activeTool,
      color: toolSettings.color,
      opacity: toolSettings.opacity,
      strokeWidth: toolSettings.strokeWidth,
      // Attributes for shapes
      pixelateStyle: activeTool === 'pixelate' ? toolSettings.pixelateStyle : undefined,
      highlighterStyle: activeTool === 'highlighter' ? toolSettings.highlighterStyle : undefined,
      arrowStyle: activeTool === 'arrow' ? toolSettings.arrowStyle : undefined,
      
      points: isFreehand ? [pos] : undefined,
      x: !isFreehand ? pos.x : undefined,
      y: !isFreehand ? pos.y : undefined,
      width: 0,
      height: 0,
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

        let newW = Math.max(10, potentialW);
        let newH = Math.max(10, potentialH);
        if (e.shiftKey) {
            newW = Math.round(newW / 50) * 50;
            newH = Math.round(newH / 50) * 50;
        }

        const roundedWidth = Math.max(10, Math.round(newW));
        const roundedHeight = Math.max(10, Math.round(newH));
        setCanvasResizeState(current => current ? {
            ...current,
            previewWidth: roundedWidth,
            previewHeight: roundedHeight,
            offsetX: handle.includes('w') ? roundedWidth - startWidth : 0,
            offsetY: handle.includes('n') ? roundedHeight - startHeight : 0,
        } : null);
        return;
    }

    if (!canvasRef.current) return;
    const pos = getMousePos(canvasRef.current, e);

    if (marquee) {
        setMarquee({ ...marquee, current: pos });
        return;
    }

    if (groupTransformState) {
        const { handle, startPos, bounds, originalElements, startAngle } = groupTransformState;
        const originalById = new Map(originalElements.map(element => [element.id, element]));
        let updatedSelected: DrawingElement[];

        if (handle === 'rotate') {
            const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
            const angle = Math.atan2(pos.y - center.y, pos.x - center.x) - startAngle;
            updatedSelected = originalElements.map(element => {
                const updated = { ...element };
                if (updated.points) {
                    updated.points = updated.points.map(point => rotatePoint(point, center, angle));
                    return updated;
                }
                const elementCenter = {
                    x: (updated.x || 0) + (updated.width || 0) / 2,
                    y: (updated.y || 0) + (updated.height || 0) / 2,
                };
                const rotatedCenter = rotatePoint(elementCenter, center, angle);
                updated.x = rotatedCenter.x - (updated.width || 0) / 2;
                updated.y = rotatedCenter.y - (updated.height || 0) / 2;
                if (updated.type !== 'stamp' && updated.type !== 'symbol' && updated.type !== 'spotlight') {
                    updated.rotation = (updated.rotation || 0) + angle;
                }
                return updated;
            });
        } else {
            const dx = pos.x - startPos.x;
            const dy = pos.y - startPos.y;
            let left = bounds.x;
            let top = bounds.y;
            let right = bounds.x + bounds.w;
            let bottom = bounds.y + bounds.h;
            if (handle?.includes('w')) left += dx;
            if (handle?.includes('e')) right += dx;
            if (handle?.includes('n')) top += dy;
            if (handle?.includes('s')) bottom += dy;
            if (right - left < 8) handle?.includes('w') ? left = right - 8 : right = left + 8;
            if (bottom - top < 8) handle?.includes('n') ? top = bottom - 8 : bottom = top + 8;
            const scaleX = bounds.w > 0 ? (right - left) / bounds.w : 1;
            const scaleY = bounds.h > 0 ? (bottom - top) / bounds.h : 1;
            const averageScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;

            updatedSelected = originalElements.map(element => {
                const updated = { ...element };
                if (updated.points) {
                    updated.points = updated.points.map(point => ({
                        x: left + (point.x - bounds.x) * scaleX,
                        y: top + (point.y - bounds.y) * scaleY,
                    }));
                    return updated;
                }
                updated.x = left + ((updated.x || 0) - bounds.x) * scaleX;
                updated.y = top + ((updated.y || 0) - bounds.y) * scaleY;
                if (updated.width !== undefined) updated.width *= scaleX;
                if (updated.height !== undefined) updated.height *= scaleY;
                if (updated.type === 'stamp') {
                    const diameter = (updated.stampSize ?? (10 + updated.strokeWidth) * 2) * averageScale;
                    updated.stampSize = Math.max(8, diameter);
                    updated.strokeWidth = updated.stampSize;
                }
                if (updated.type === 'symbol') updated.strokeWidth = Math.max(8, updated.strokeWidth * averageScale);
                return updated;
            });
        }

        const transformedById = new Map(updatedSelected.map(element => [element.id, element]));
        const updatedElements = tab.elements.map(element => transformedById.get(element.id) || originalById.get(element.id) || element);
        updateTab(tab.id, { elements: updatedElements });
        return;
    }

    if (!isDrawing && !isDragging && !elementResizeState) {
        if (selectedElementIds.length === 1 && selectedElementId) {
            const selectedEl = tab.elements.find(el => el.id === selectedElementId);
            if (selectedEl && !selectedEl.locked) {
                const handle = getResizeHandleType(pos.x, pos.y, selectedEl);
                if (handle) {
                    setCursor(getCursorForHandle(handle));
                } else if (canvasRef.current && isPointInElement(pos.x, pos.y, selectedEl, canvasRef.current.getContext('2d')!)) {
                    setCursor('move');
                } else {
                     setCursor(activeTool === 'select' ? 'default' : 'crosshair');
                }
            } else {
                setCursor(activeTool === 'select' ? 'default' : 'crosshair');
            }
        } else if (selectedElementIds.length > 1) {
            const groupElements = tab.elements.filter(element => selectedElementIds.includes(element.id) && !element.hidden);
            const groupBounds = getGroupBounds(groupElements);
            const groupHandle = groupBounds && groupElements.every(element => !element.locked)
                ? getGroupHandle(pos.x, pos.y, groupBounds)
                : null;
            if (groupHandle) {
                setCursor(getCursorForHandle(groupHandle));
                return;
            }
            const selectedHit = tab.elements.some(element =>
                selectedElementIds.includes(element.id) &&
                isPointInElement(pos.x, pos.y, element, canvasRef.current!.getContext('2d')!)
            );
            setCursor(selectedHit ? 'move' : 'default');
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
             
             const currentAngle = Math.atan2(pos.y - cy, pos.x - cx);
             let newRotation = currentAngle + Math.PI / 2;
             
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

    if (isDragging && selectedElementIds.length > 0 && dragStartPos) {
      let dx = pos.x - dragStartPos.x;
      let dy = pos.y - dragStartPos.y;
      const movingElements = tab.elements.filter(element => selectedElementIds.includes(element.id) && !element.hidden);
      const movingBounds = getGroupBounds(movingElements);

      if (movingBounds && !e.altKey) {
        const threshold = 6 / Math.max(0.1, tab.scale);
        const otherBounds = tab.elements
          .filter(element => !selectedElementIds.includes(element.id) && !element.hidden)
          .map(getElementBounds);
        const verticalTargets = [0, tab.canvasWidth / 2, tab.canvasWidth];
        const horizontalTargets = [0, tab.canvasHeight / 2, tab.canvasHeight];
        otherBounds.forEach(bounds => {
          verticalTargets.push(bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w);
          horizontalTargets.push(bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h);
        });

        const movingX = [movingBounds.x, movingBounds.x + movingBounds.w / 2, movingBounds.x + movingBounds.w];
        const movingY = [movingBounds.y, movingBounds.y + movingBounds.h / 2, movingBounds.y + movingBounds.h];
        let bestXOffset: number | undefined;
        let bestXTarget: number | undefined;
        let bestYOffset: number | undefined;
        let bestYTarget: number | undefined;

        for (const target of verticalTargets) {
          for (const anchor of movingX) {
            const offset = target - (anchor + dx);
            if (Math.abs(offset) <= threshold && (bestXOffset === undefined || Math.abs(offset) < Math.abs(bestXOffset))) {
              bestXOffset = offset;
              bestXTarget = target;
            }
          }
        }
        for (const target of horizontalTargets) {
          for (const anchor of movingY) {
            const offset = target - (anchor + dy);
            if (Math.abs(offset) <= threshold && (bestYOffset === undefined || Math.abs(offset) < Math.abs(bestYOffset))) {
              bestYOffset = offset;
              bestYTarget = target;
            }
          }
        }

        if (bestXOffset !== undefined) dx += bestXOffset;
        if (bestYOffset !== undefined) dy += bestYOffset;
        setSnapGuides({
          vertical: bestXTarget !== undefined ? [bestXTarget] : [],
          horizontal: bestYTarget !== undefined ? [bestYTarget] : [],
        });
      } else {
        setSnapGuides({ vertical: [], horizontal: [] });
      }

      const updatedElements = tab.elements.map(el => {
        if (!selectedElementIds.includes(el.id) || el.locked) return el;
        const newEl = { ...el };
        if (newEl.points) {
          newEl.points = newEl.points.map(point => ({ x: point.x + dx, y: point.y + dy }));
        } else {
          newEl.x = (el.x || 0) + dx;
          newEl.y = (el.y || 0) + dy;
        }
        return newEl;
      });
      updateTab(tab.id, { elements: updatedElements });
      setDragStartPos(pos);
      return;
    }

    if (!isDrawing || !currentElement || !dragStartPos) return;

    if (activeTool === 'pen' || (activeTool === 'highlighter' && toolSettings.highlighterStyle === 'brush')) {
      let nextPoint = pos;
      if (activeTool === 'highlighter' && e.shiftKey) {
          nextPoint = { x: pos.x, y: dragStartPos.y };
      }
      const newPoints = [...(currentElement.points || []), nextPoint];
      setCurrentElement({ ...currentElement, points: newPoints });

    } else {
      // Box based tools
      let w = pos.x - dragStartPos.x;
      let h = pos.y - dragStartPos.y;

      // Shift key constraints (Snapping & Aspect Ratio)
      if (e.shiftKey) {
          if (activeTool === 'line' || activeTool === 'arrow') {
               // Snap to 45 degree increments for lines and arrows
               const dist = Math.sqrt(w*w + h*h);
               const angle = Math.atan2(h, w);
               const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4); 
               w = Math.cos(snapAngle) * dist;
               h = Math.sin(snapAngle) * dist;
               // Clean up floating point errors for perfect verticals/horizontals
               if (Math.abs(w) < 1e-5) w = 0;
               if (Math.abs(h) < 1e-5) h = 0;
          } else if (['rect', 'circle', 'triangle', 'diamond'].includes(activeTool) || (activeTool === 'highlighter' && toolSettings.highlighterStyle === 'rect')) {
               // 1:1 Aspect Ratio (Square/Circle)
               const dim = Math.max(Math.abs(w), Math.abs(h));
               w = w < 0 ? -dim : dim;
               h = h < 0 ? -dim : dim;
          }
      }

      setCurrentElement({ 
          ...currentElement, 
          width: w, 
          height: h,
          x: dragStartPos.x, 
          y: dragStartPos.y
      });
    }
  };

  const handleMouseUp = async () => {
    if (canvasResizeState) {
        if (resizeCommitRef.current) return;
        resizeCommitRef.current = true;
        const resizeState = canvasResizeState;
        const didResize =
            resizeState.previewWidth !== resizeState.startWidth ||
            resizeState.previewHeight !== resizeState.startHeight;
        try {
            if (didResize) {
                const resized = await resizeCanvasDocument(
                    tab,
                    resizeState.previewWidth,
                    resizeState.previewHeight,
                    resizeState.offsetX,
                    resizeState.offsetY
                );
                const newHistory = tab.history.slice(0, tab.historyIndex + 1);
                newHistory.push(createDocumentSnapshot(tab, resized));
                updateTab(tab.id, {
                    ...resized,
                    history: newHistory,
                    historyIndex: newHistory.length - 1,
                });
            }
        } finally {
            setCanvasResizeState(null);
            resizeCommitRef.current = false;
        }
        return;
    }
    if (groupTransformState) {
        setGroupTransformState(null);
        const newHistory = tab.history.slice(0, tab.historyIndex + 1);
        newHistory.push(createDocumentSnapshot(tab));
        updateTab(tab.id, { history: newHistory, historyIndex: newHistory.length - 1 });
        return;
    }
    if (marquee) {
        const left = Math.min(marquee.start.x, marquee.current.x);
        const top = Math.min(marquee.start.y, marquee.current.y);
        const right = Math.max(marquee.start.x, marquee.current.x);
        const bottom = Math.max(marquee.start.y, marquee.current.y);
        const selected = tab.elements
            .filter(element => !element.hidden)
            .filter(element => {
                const bounds = getElementBounds(element);
                return bounds.x <= right && bounds.x + bounds.w >= left && bounds.y <= bottom && bounds.y + bounds.h >= top;
            })
            .map(element => element.id);
        setSelectedElementIds(selected);
        setMarquee(null);
        return;
    }
    if (elementResizeState) {
        setElementResizeState(null);
        const newHistory = tab.history.slice(0, tab.historyIndex + 1);
        newHistory.push(createDocumentSnapshot(tab));
        updateTab(tab.id, { history: newHistory, historyIndex: newHistory.length - 1 });
        return;
    }
    if (isDragging) {
      setIsDragging(false);
      setDragStartPos(null);
      setSnapGuides({ vertical: [], horizontal: [] });
      const newHistory = tab.history.slice(0, tab.historyIndex + 1);
      newHistory.push(createDocumentSnapshot(tab));
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

    // ERASER BOX TOOL LOGIC
    if (activeTool === 'eraser') {
        const w = currentElement.width || 0;
        const h = currentElement.height || 0;
        const x = currentElement.x || 0;
        const y = currentElement.y || 0;

        // Normalize Eraser Rect
        let ex = w < 0 ? x + w : x;
        let ey = h < 0 ? y + h : y;
        let ew = Math.abs(w);
        let eh = Math.abs(h);

        // Filter out intersecting elements
        const remainingElements = tab.elements.filter(el => {
             if (el.locked || el.hidden) return true;
             const b = getElementBounds(el);
             // Simple AABB Intersection
             const intersect = !(
                 b.x > ex + ew || 
                 b.x + b.w < ex || 
                 b.y > ey + eh || 
                 b.y + b.h < ey
             );
             return !intersect;
        });

        if (remainingElements.length !== tab.elements.length) {
            const newHistory = tab.history.slice(0, tab.historyIndex + 1);
            newHistory.push(createDocumentSnapshot(tab, { elements: remainingElements }));
            updateTab(tab.id, { elements: remainingElements, history: newHistory, historyIndex: newHistory.length - 1 });
        }
        
        setCurrentElement(null);
        return;
    }

    if (activeTool === 'text' || activeTool === 'callout') {
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
            elementType: activeTool,
            x: finalX,
            y: finalY,
            width: finalW,
            height: finalH,
            text: '',
            color: toolSettings.color,
            fontSize: toolSettings.fontSize,
            opacity: toolSettings.opacity,
            visible: true
        });
        setCurrentElement(null);
        return;
    }
    
    // Cull small geometric shapes (except brush highlighter/pen)
    const isBoxTool = ['rect', 'arrow', 'circle', 'triangle', 'diamond', 'line', 'spotlight'].includes(activeTool);
    const isHighlighterRect = activeTool === 'highlighter' && toolSettings.highlighterStyle === 'rect';
    
    if (isBoxTool || isHighlighterRect) {
        const w = Math.abs(currentElement.width || 0);
        const h = Math.abs(currentElement.height || 0);

        if (activeTool === 'line' || activeTool === 'arrow') {
             // For lines and arrows, check the length, allowing vertical (w=0) or horizontal (h=0) lines
             if (Math.sqrt(w * w + h * h) < 5) {
                 setCurrentElement(null);
                 return;
             }
        } else {
            // For other shapes, ensure it's not just a tiny dot
            if (w < 5 && h < 5) {
                setCurrentElement(null);
                return;
            }
        }
    }

    let finalElement = { ...currentElement };
    // Normalize negative dimensions for basic shapes (makes resize logic easier later)
    if (['rect', 'spotlight', 'pixelate', 'circle', 'triangle', 'diamond', 'line', 'highlighter'].includes(finalElement.type as string)) {
        const w = finalElement.width || 0;
        const h = finalElement.height || 0;
        // Skip normalizing for Line or Highlighter Brush
        if (finalElement.type !== 'line' && (finalElement.type !== 'highlighter' || finalElement.highlighterStyle === 'rect')) {
             if (w < 0) { finalElement.x = (finalElement.x || 0) + w; finalElement.width = Math.abs(w); }
             if (h < 0) { finalElement.y = (finalElement.y || 0) + h; finalElement.height = Math.abs(h); }
        }
    }

    const newElements = [...tab.elements, finalElement];
    const newHistory = tab.history.slice(0, tab.historyIndex + 1);
    newHistory.push(createDocumentSnapshot(tab, { elements: newElements }));
    updateTab(tab.id, { elements: newElements, history: newHistory, historyIndex: newHistory.length - 1 });
    setCurrentElement(null);
    setSelectedElementId(finalElement.id); 
  };
  
  // ... handleCanvasResizeStart and render ...
  const handleCanvasResizeStart = (e: React.MouseEvent, handle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se') => {
      e.preventDefault();
      e.stopPropagation();
      setCanvasResizeState({
          handle,
          startScreenPos: { x: e.clientX, y: e.clientY },
          startWidth: tab.canvasWidth,
          startHeight: tab.canvasHeight,
          previewWidth: tab.canvasWidth,
          previewHeight: tab.canvasHeight,
          offsetX: 0,
          offsetY: 0,
      });
  };

  const previewWidth = canvasResizeState?.previewWidth ?? tab.canvasWidth;
  const previewHeight = canvasResizeState?.previewHeight ?? tab.canvasHeight;
  const previewOffsetX = canvasResizeState?.offsetX ?? 0;
  const previewOffsetY = canvasResizeState?.offsetY ?? 0;
  const previewWidthDelta = previewWidth - (canvasResizeState?.startWidth ?? tab.canvasWidth);
  const previewHeightDelta = previewHeight - (canvasResizeState?.startHeight ?? tab.canvasHeight);
  const previewTranslateX = canvasResizeState?.handle.includes('e')
    ? previewWidthDelta / 2
    : canvasResizeState?.handle.includes('w') ? -previewWidthDelta / 2 : 0;
  const previewTranslateY = canvasResizeState?.handle.includes('s')
    ? previewHeightDelta / 2
    : canvasResizeState?.handle.includes('n') ? -previewHeightDelta / 2 : 0;

  const handleQuickAddSpace = async (edge: CanvasEdge) => {
    if (addingSpaceEdge) return;
    setAddingSpaceEdge(edge);
    try {
      await onAddCanvasSpace(edge, 200);
    } finally {
      setAddingSpaceEdge(null);
    }
  };

  const handleViewportMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'hand' || event.button !== 0 || !containerRef.current) return;
    event.preventDefault();
    setPanState({
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    });
  };

  const handleViewportMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!panState || !containerRef.current) return;
    containerRef.current.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
    containerRef.current.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
  };

  const quickAddButtonClass = 'absolute z-30 inline-flex h-7 w-7 items-center justify-center rounded-full border border-brand-300 bg-white text-brand-600 shadow-md transition hover:scale-110 hover:border-brand-500 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-wait disabled:opacity-50 dark:border-brand-700 dark:bg-slate-800 dark:text-brand-300 dark:hover:bg-slate-700';

  return (
    <div 
      ref={containerRef} 
      data-editor-viewport
      className="flex-1 min-w-0 min-h-0 bg-slate-200 dark:bg-slate-950 overflow-auto relative transition-colors"
      style={{ cursor: activeTool === 'hand' ? (panState ? 'grabbing' : 'grab') : undefined }}
      onMouseDown={handleViewportMouseDown}
      onMouseMove={(e) => {
          if (panState) handleViewportMouseMove(e);
          if (canvasResizeState) handleMouseMove(e);
      }}
      onMouseUp={() => {
          if (panState) {
            setPanState(null);
            return;
          }
          void handleMouseUp();
      }}
      onMouseLeave={() => setPanState(null)}
      onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
          e.preventDefault();
          const imageFile = Array.from(e.dataTransfer.files).find(file => file.type.startsWith('image/'));
          if (imageFile) void onImageDrop(imageFile);
      }}
    >
      <div className="box-border flex min-h-full min-w-full p-8">
        <div
          className={`group relative m-auto shrink-0 bg-white shadow-lg shadow-slate-400/50 dark:shadow-black/50 ${canvasResizeState ? 'overflow-hidden' : ''}`}
          style={{
            width: previewWidth * tab.scale,
            height: previewHeight * tab.scale,
            minWidth: previewWidth * tab.scale,
            minHeight: previewHeight * tab.scale,
            transform: `translate(${previewTranslateX * tab.scale}px, ${previewTranslateY * tab.scale}px)`,
          }}
        >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            if (!canvasResizeState && activeTool !== 'hand') void handleMouseUp();
          }}
          onDoubleClick={handleDoubleClick}
          style={{ 
            cursor: activeTool === 'hand' ? (panState ? 'grabbing' : 'grab') : cursor,
            position: 'absolute',
            left: previewOffsetX * tab.scale,
            top: previewOffsetY * tab.scale,
            width: tab.canvasWidth * tab.scale,
            height: tab.canvasHeight * tab.scale,
          }}
          className="block"
        />

        {canvasResizeState && (
          <div className="pointer-events-none absolute right-2 top-2 z-30 rounded-md bg-slate-900/80 px-2 py-1 text-xs font-medium text-white shadow">
            {previewWidth} × {previewHeight}px{canvasResizeState.offsetX || canvasResizeState.offsetY ? ' · content shifted' : ''}
          </div>
        )}

        {!tab.imageDataUrl && tab.elements.length === 0 && !currentElement && activeTool === 'select' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl border-2 border-dashed border-brand-200 bg-white/90 px-6 py-7 text-center shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
              <ImagePlus className="mx-auto mb-3 text-brand-500" size={34} />
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Start with an image</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Drop an image here, paste from the clipboard, or open a file.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={onOpenFile} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
                  <FolderOpen size={16} /> Open image
                </button>
                <button type="button" onClick={() => void onPasteImage()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                  <ClipboardPaste size={16} /> Paste
                </button>
                <button type="button" onClick={onScreenCapture} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                  <MonitorUp size={16} /> Capture
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeTool === 'select' && selectedElementIds.length === 0 && (
          <>
            <button type="button" aria-label="Resize canvas from top left" className="absolute top-0 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-400 cursor-nwse-resize z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-125 transition-all"
                 onMouseDown={(e) => handleCanvasResizeStart(e, 'nw')}></button>
            <button type="button" aria-label="Resize canvas from top right" className="absolute top-0 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2 bg-white border border-slate-400 cursor-nesw-resize z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-125 transition-all"
                 onMouseDown={(e) => handleCanvasResizeStart(e, 'ne')}></button>
            <button type="button" aria-label="Resize canvas from bottom left" className="absolute bottom-0 left-0 w-3 h-3 -translate-x-1/2 translate-y-1/2 bg-white border border-slate-400 cursor-nesw-resize z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-125 transition-all"
                 onMouseDown={(e) => handleCanvasResizeStart(e, 'sw')}></button>
            <button type="button" aria-label="Resize canvas from bottom right" className="absolute bottom-0 right-0 w-3 h-3 translate-x-1/2 translate-y-1/2 bg-white border border-slate-400 cursor-nwse-resize z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-125 transition-all"
                 onMouseDown={(e) => handleCanvasResizeStart(e, 'se')}></button>
            <button type="button" aria-label="Resize canvas from top" className="absolute top-0 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-400 cursor-ns-resize z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-125 transition-all"
                 onMouseDown={(e) => handleCanvasResizeStart(e, 'n')}></button>
            <button type="button" aria-label="Resize canvas from bottom" className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 bg-white border border-slate-400 cursor-ns-resize z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-125 transition-all"
                 onMouseDown={(e) => handleCanvasResizeStart(e, 's')}></button>
            <button type="button" aria-label="Resize canvas from left" className="absolute top-1/2 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-400 cursor-ew-resize z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-125 transition-all"
                 onMouseDown={(e) => handleCanvasResizeStart(e, 'w')}></button>
            <button type="button" aria-label="Resize canvas from right" className="absolute top-1/2 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2 bg-white border border-slate-400 cursor-ew-resize z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-125 transition-all"
                 onMouseDown={(e) => handleCanvasResizeStart(e, 'e')}></button>
          </>
        )}

        {activeTool === 'select' && selectedElementIds.length === 0 && !canvasResizeState && (
          <>
            <button
              type="button"
              aria-label="Add 200px blank space to top"
              title="Add 200px above"
              disabled={addingSpaceEdge !== null}
              className={quickAddButtonClass}
              style={{ left: '70%', top: 0, transform: 'translate(-50%, -50%)' }}
              onMouseDown={event => event.stopPropagation()}
              onClick={() => void handleQuickAddSpace('top')}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              aria-label="Add 200px blank space to bottom"
              title="Add 200px below"
              disabled={addingSpaceEdge !== null}
              className={quickAddButtonClass}
              style={{ left: '70%', bottom: 0, transform: 'translate(-50%, 50%)' }}
              onMouseDown={event => event.stopPropagation()}
              onClick={() => void handleQuickAddSpace('bottom')}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              aria-label="Add 200px blank space to left"
              title="Add 200px to the left"
              disabled={addingSpaceEdge !== null}
              className={quickAddButtonClass}
              style={{ left: 0, top: '70%', transform: 'translate(-50%, -50%)' }}
              onMouseDown={event => event.stopPropagation()}
              onClick={() => void handleQuickAddSpace('left')}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              aria-label="Add 200px blank space to right"
              title="Add 200px to the right"
              disabled={addingSpaceEdge !== null}
              className={quickAddButtonClass}
              style={{ right: 0, top: '70%', transform: 'translate(50%, -50%)' }}
              onMouseDown={event => event.stopPropagation()}
              onClick={() => void handleQuickAddSpace('right')}
            >
              <Plus size={15} />
            </button>
          </>
        )}

        {textInput && textInput.visible && (
          <textarea
            autoFocus
            value={textInput.text}
            onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
            onBlur={commitText}
            onKeyDown={(e) => {
               if (e.key === 'Escape') setTextInput(null);
            }}
            style={{
              position: 'absolute',
              left: textInput.x * tab.scale,
              top: textInput.y * tab.scale,
              width: textInput.width * tab.scale,
              height: textInput.height * tab.scale,
              fontSize: `${textInput.fontSize * tab.scale}px`,
              fontFamily: 'sans-serif',
              lineHeight: String(textInput.originalElement?.lineHeight ?? 1.2),
              textAlign: textInput.originalElement?.textAlign ?? 'left',
              color: textInput.color,
              background: textInput.elementType === 'callout' ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
              border: textInput.elementType === 'callout' ? `2px solid ${textInput.color}` : '1px dashed #3b82f6',
              outline: 'none',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              boxSizing: 'border-box',
              resize: 'none',
              padding: textInput.elementType === 'callout' ? `${10 * tab.scale}px` : '0',
              zIndex: 50,
            }}
            placeholder="Type here..."
          />
        )}
        </div>
      </div>
    </div>
  );
};

export default Editor;
