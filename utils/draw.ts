import React from 'react';
import { DrawingElement, Point, ArrowStyle, StampStyle } from '../types';
import { HIGHLIGHTER_OPACITY } from '../constants';

// Helper to load images for the canvas renderer
const imageCache: Record<string, HTMLImageElement> = {};

const getImage = (src: string): HTMLImageElement | null => {
  if (imageCache[src]) {
    return imageCache[src].complete ? imageCache[src] : null;
  }
  const img = new Image();
  img.src = src;
  img.onload = () => {}; // Force load
  imageCache[src] = img;
  return null; // Return null on first render, it will re-render when React state updates or next frame
};

// Helper function to wrap text with newline support
const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const paragraphs = text.split('\n');
    let currentY = y;
    const effectiveWidth = Math.max(20, maxWidth);

    paragraphs.forEach(paragraph => {
        const words = paragraph.split(' ');
        let line = '';
        let testLine = '';
        let testWidth = 0;

        if (paragraph.length === 0) {
            currentY += lineHeight;
            return;
        }

        for(let n = 0; n < words.length; n++) {
            testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            testWidth = metrics.width;
            
            if (maxWidth > 0 && testWidth > effectiveWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
        currentY += lineHeight;
    });
};

const drawArrow = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, strokeWidth: number, style: ArrowStyle = 'filled') => {
    // Start from x, y
    const startX = x;
    const startY = y;
    // End at x+w, y+h
    const endX = x + w;
    const endY = y + h;

    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);

    const headLength = Math.max(strokeWidth * 3.5, 10); 
    const headWidth = Math.max(strokeWidth * 2.5, 8); 

    const safeLength = Math.max(length, 1);
    const scale = length < headLength ? safeLength / headLength : 1;
    const actualHeadLength = headLength * scale;

    ctx.beginPath();

    if (style === 'filled') {
        const lineEndDist = length - actualHeadLength * 0.9; 
        const lineEndX = startX + Math.cos(angle) * lineEndDist;
        const lineEndY = startY + Math.sin(angle) * lineEndDist;

        ctx.moveTo(startX, startY);
        ctx.lineTo(lineEndX, lineEndY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - actualHeadLength * Math.cos(angle - Math.PI / 7),
            endY - actualHeadLength * Math.sin(angle - Math.PI / 7)
        );
        ctx.lineTo(
            endX - actualHeadLength * Math.cos(angle + Math.PI / 7),
            endY - actualHeadLength * Math.sin(angle + Math.PI / 7)
        );
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
    } else {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - actualHeadLength * Math.cos(angle - Math.PI / 6),
            endY - actualHeadLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - actualHeadLength * Math.cos(angle + Math.PI / 6),
            endY - actualHeadLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
    }
};

const drawStamp = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, strokeWidth: number, style: StampStyle = 'circle') => {
    const radius = 10 + strokeWidth; 
    ctx.beginPath();
    
    if (style === 'square') {
         ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
    } else {
         ctx.arc(x, y, radius, 0, 2 * Math.PI);
    }
    
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${radius * 1.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + radius * 0.1); 
};

// Apply Pixelation to a region
const applyPixelate = (ctx: CanvasRenderingContext2D, width: number, height: number, pixelSize: number = 10) => {
    try {
        const transform = ctx.getTransform();
        
        // Start point in device coords (which corresponds to (0,0) in local space)
        const startX = transform.e;
        const startY = transform.f;
        
        // Dimensions in device coords
        const w = width * transform.a; 
        const h = height * transform.d;

        // Calculate actual screen rectangle (normalized)
        let rx = startX;
        let ry = startY;
        let rw = w;
        let rh = h;

        // Handle negative dimensions (dragging left/up)
        if (rw < 0) {
            rx += rw;
            rw = -rw;
        }
        if (rh < 0) {
            ry += rh;
            rh = -rh;
        }

        if (rw < 1 || rh < 1) return;

        // Grab pixels from the canvas itself (what's drawn so far)
        const imageData = ctx.getImageData(rx, ry, rw, rh);
        const data = imageData.data;
        const sw = imageData.width;
        const sh = imageData.height;
        
        const size = Math.floor(pixelSize * window.devicePixelRatio); 

        for (let y = 0; y < sh; y += size) {
            for (let x = 0; x < sw; x += size) {
                // Get center pixel color
                const pY = Math.min(y + Math.floor(size/2), sh-1);
                const pX = Math.min(x + Math.floor(size/2), sw-1);
                const i = (pY * sw + pX) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                // Fill block
                for (let by = y; by < y + size && by < sh; by++) {
                    for (let bx = x; bx < x + size && bx < sw; bx++) {
                        const bi = (by * sw + bx) * 4;
                        data[bi] = r;
                        data[bi + 1] = g;
                        data[bi + 2] = b;
                        data[bi + 3] = a;
                    }
                }
            }
        }
        
        ctx.putImageData(imageData, rx, ry);
        
    } catch (e) {
        // Fallback or ignore
    }
}

// Apply Blur to a region
const applyBlur = (ctx: CanvasRenderingContext2D, width: number, height: number, blurAmount: number = 8) => {
    try {
         const transform = ctx.getTransform();
        
        // Start point in device coords
        const startX = transform.e;
        const startY = transform.f;
        
        // Dimensions in device coords
        const w = width * transform.a; 
        const h = height * transform.d;

        // Calculate actual screen rectangle (normalized)
        let rx = startX;
        let ry = startY;
        let rw = w;
        let rh = h;

        if (rw < 0) {
            rx += rw;
            rw = -rw;
        }
        if (rh < 0) {
            ry += rh;
            rh = -rh;
        }

        if (rw < 1 || rh < 1) return;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = rw;
        offCanvas.height = rh;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) return;

        // Copy current region
        offCtx.drawImage(ctx.canvas, rx, ry, rw, rh, 0, 0, rw, rh);
        
        // Draw back with blur
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to draw in absolute coords
        ctx.filter = `blur(${blurAmount}px)`;
        ctx.drawImage(offCanvas, rx, ry);
        ctx.filter = 'none';
        ctx.restore();

    } catch (e) {
        // Ignore
    }
};

export const renderCanvas = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  bgImage: HTMLImageElement | null,
  elements: DrawingElement[],
  activeElement: DrawingElement | null, 
  selectedElementId: string | null,
  scale: number = 1,
  pixelRatio: number = 1 
) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Base Scale for High DPI
  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw Background
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0);
  } else {
    const logicalW = canvas.width / pixelRatio;
    const logicalH = canvas.height / pixelRatio;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalW, logicalH);
    if (elements.length === 0 && !activeElement) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Paste an image (Ctrl+V) to start', logicalW / 2, logicalH / 2);
    }
  }

  // Draw Elements
  elements.forEach((el) => {
    drawElement(ctx, el);
  });

  // Draw Active Element
  if (activeElement) {
    drawElement(ctx, activeElement);
    if (activeElement.type === 'text' || activeElement.type === 'crop') {
       ctx.save();
       ctx.strokeStyle = activeElement.type === 'crop' ? '#000' : '#94a3b8';
       if (activeElement.type === 'crop') {
           ctx.setLineDash([5, 5]);
           ctx.lineWidth = 2;
           ctx.strokeRect(activeElement.x || 0, activeElement.y || 0, activeElement.width || 0, activeElement.height || 0);
           // Dim outside
           ctx.fillStyle = 'rgba(0,0,0,0.3)';
           // 4 rects to dim outside
           const ax = activeElement.x || 0;
           const ay = activeElement.y || 0;
           const aw = activeElement.width || 0;
           const ah = activeElement.height || 0;
           const cw = canvas.width / pixelRatio;
           const ch = canvas.height / pixelRatio;
           
           ctx.fillRect(0, 0, cw, ay); // Top
           ctx.fillRect(0, ay + ah, cw, ch - (ay + ah)); // Bottom
           ctx.fillRect(0, ay, ax, ah); // Left
           ctx.fillRect(ax + aw, ay, cw - (ax + aw), ah); // Right
       } else {
           ctx.setLineDash([5, 5]);
           ctx.strokeRect(activeElement.x || 0, activeElement.y || 0, activeElement.width || 0, activeElement.height || 0);
       }
       ctx.restore();
    }
  }
  
  // Selection Border (drawn on top of everything)
  const selectedEl = elements.find(e => e.id === selectedElementId);
  if (selectedEl) {
      drawSelectionBorder(ctx, selectedEl);
  }
};

const drawSelectionBorder = (ctx: CanvasRenderingContext2D, el: DrawingElement) => {
  ctx.save();
  
  // Translate & Rotate to match element
  const cx = (el.x || 0) + (el.width || 0) / 2;
  const cy = (el.y || 0) + (el.height || 0) / 2;
  
  if (el.type !== 'pen' && el.type !== 'highlighter' && el.type !== 'stamp') {
      ctx.translate(cx, cy);
      if (el.rotation) ctx.rotate(el.rotation);
      ctx.translate(-cx, -cy);
  }

  ctx.strokeStyle = el.locked ? '#ef4444' : '#3b82f6'; 
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  
  const padding = 4;
  let x = el.x || 0;
  let y = el.y || 0;
  let w = el.width || 0;
  let h = el.height || 0;

  if (el.type === 'pen' || (el.type === 'highlighter' && (!el.highlighterStyle || el.highlighterStyle === 'brush'))) {
      if (el.points) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        el.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
        x = minX; y = minY; w = maxX - minX; h = maxY - minY;
      }
  } else if (el.type === 'stamp') {
      const radius = 10 + el.strokeWidth;
      x = (el.x || 0) - radius; y = (el.y || 0) - radius; w = radius * 2; h = radius * 2;
  }

  const drawX = w < 0 ? x + w : x;
  const drawY = h < 0 ? y + h : y;
  const drawW = Math.abs(w);
  const drawH = Math.abs(h);

  // Draw border
  ctx.strokeRect(drawX - padding, drawY - padding, drawW + padding * 2, drawH + padding * 2);
  
  if (!el.locked && ['rect', 'image', 'text', 'arrow', 'pixelate', 'circle', 'triangle', 'diamond', 'line', 'highlighter'].includes(el.type)) {
      if (el.type === 'highlighter' && (!el.highlighterStyle || el.highlighterStyle === 'brush')) {
          // No handles for brush highlighter
      } else {
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#3b82f6';
        
        const handleSize = 8;
        const half = handleSize / 2;

        const left = drawX - padding;
        const right = drawX + drawW + padding;
        const top = drawY - padding;
        const bottom = drawY + drawH + padding;
        const midX = drawX + drawW / 2;
        const midY = drawY + drawH / 2;

        // Resize Handles
        const handles = [
            { x: left, y: top }, { x: midX, y: top }, { x: right, y: top },
            { x: right, y: midY }, { x: right, y: bottom }, { x: midX, y: bottom },
            { x: left, y: bottom }, { x: left, y: midY },
        ];

        handles.forEach(hPos => {
            ctx.fillRect(hPos.x - half, hPos.y - half, handleSize, handleSize);
            ctx.strokeRect(hPos.x - half, hPos.y - half, handleSize, handleSize);
        });

        // Rotation Handle (Top Center, sticking out)
        const rotDist = 20;
        const rotX = midX;
        const rotY = top - rotDist;
        
        ctx.beginPath();
        ctx.moveTo(midX, top);
        ctx.lineTo(rotX, rotY);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(rotX, rotY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
  }

  ctx.restore();
}

const drawElement = (ctx: CanvasRenderingContext2D, el: DrawingElement) => {
  ctx.save();
  
  if (el.type === 'eraser') {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.fillRect(el.x || 0, el.y || 0, el.width || 0, el.height || 0);
      ctx.strokeRect(el.x || 0, el.y || 0, el.width || 0, el.height || 0);
      ctx.restore();
      return;
  }

  if (el.type === 'pixelate') {
       if (!el.rotation) {
           ctx.translate(el.x || 0, el.y || 0);
           if (el.pixelateStyle === 'blur') {
               applyBlur(ctx, el.width || 0, el.height || 0);
           } else {
               applyPixelate(ctx, el.width || 0, el.height || 0, 10);
           }
           ctx.restore();
           return;
       }
       // Fallback for rotated pixelate (just transparent gray)
       ctx.translate((el.x || 0) + (el.width || 0)/2, (el.y || 0) + (el.height || 0)/2);
       if (el.rotation) ctx.rotate(el.rotation);
       ctx.translate(-(el.width || 0)/2, -(el.height || 0)/2);
       ctx.fillStyle = 'rgba(100,100,100,0.2)';
       ctx.fillRect(0, 0, el.width || 0, el.height || 0);
       ctx.restore();
       return;
  }
  
  if (el.type === 'stamp') {
      // Stamp draws at specific x,y, no width/height logic usually
      if (el.x !== undefined && el.y !== undefined && el.text) {
          drawStamp(ctx, el.x, el.y, el.text, el.color, el.strokeWidth, el.stampStyle);
      }
      ctx.restore();
      return;
  }

  // Common Transformations
  const cx = (el.x || 0) + (el.width || 0) / 2;
  const cy = (el.y || 0) + (el.height || 0) / 2;

  if (['rect', 'image', 'text', 'arrow', 'circle', 'triangle', 'diamond', 'line', 'highlighter'].includes(el.type)) {
      // For highlighter rect mode, we treat it like a shape
      if (el.type !== 'highlighter' || el.highlighterStyle === 'rect') {
        ctx.translate(cx, cy);
        if (el.rotation) ctx.rotate(el.rotation);
        ctx.translate(-cx, -cy);
      }
  }

  ctx.beginPath();
  
  const isHighlighter = el.type === 'highlighter';
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (isHighlighter) {
    ctx.globalAlpha = HIGHLIGHTER_OPACITY;
    ctx.lineWidth = el.strokeWidth * 3; 
  }

  const x = el.x || 0;
  const y = el.y || 0;
  const w = el.width || 0;
  const h = el.height || 0;

  if (el.type === 'pen' || (el.type === 'highlighter' && (!el.highlighterStyle || el.highlighterStyle === 'brush'))) {
    if (el.points && el.points.length > 0) {
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i].x, el.points[i].y);
      }
      ctx.stroke();
    }
  } else if (el.type === 'highlighter' && el.highlighterStyle === 'rect') {
      ctx.globalAlpha = HIGHLIGHTER_OPACITY;
      ctx.fillRect(x, y, w, h);
  } else if (el.type === 'rect') {
      ctx.strokeRect(x, y, w, h);
  } else if (el.type === 'circle') {
      ctx.beginPath();
      ctx.ellipse(x + w/2, y + h/2, Math.abs(w)/2, Math.abs(h)/2, 0, 0, 2 * Math.PI);
      ctx.stroke();
  } else if (el.type === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.stroke();
  } else if (el.type === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.stroke();
  } else if (el.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + h);
      ctx.stroke();
  } else if (el.type === 'arrow') {
      drawArrow(ctx, x, y, w, h, el.strokeWidth, el.arrowStyle || 'filled');
  } else if (el.type === 'text') {
     if (el.x !== undefined && el.y !== undefined && el.text) {
       const fontSize = el.strokeWidth * 6;
       ctx.font = `${fontSize}px sans-serif`; 
       ctx.textBaseline = 'top'; 
       wrapText(ctx, el.text, el.x, el.y, el.width || 0, fontSize * 1.2);
     }
  } else if (el.type === 'image' && el.imageData) {
     const img = getImage(el.imageData);
     if (img) {
         ctx.drawImage(img, el.x || 0, el.y || 0, el.width || 0, el.height || 0);
     } else {
         ctx.strokeRect(el.x || 0, el.y || 0, el.width || 0, el.height || 0);
     }
  }

  ctx.restore();
};

export const getMousePos = (canvas: HTMLCanvasElement, evt: React.MouseEvent | MouseEvent): { x: number, y: number } => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) * (canvas.width / rect.width) / (window.devicePixelRatio || 1),
    y: (evt.clientY - rect.top) * (canvas.height / rect.height) / (window.devicePixelRatio || 1)
  };
};

export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Hit detection with Rotation Support
export const isPointInElement = (x: number, y: number, el: DrawingElement, ctx: CanvasRenderingContext2D): boolean => {
    // Basic Bounds
    let bx = el.x || 0;
    let by = el.y || 0;
    let bw = el.width || 0;
    let bh = el.height || 0;
    if (bw < 0) { bx += bw; bw = Math.abs(bw); }
    if (bh < 0) { by += bh; bh = Math.abs(bh); }

    // If rotated, rotate the test point AROUND the element center in REVERSE
    if (el.rotation && el.rotation !== 0 && ['rect', 'image', 'text', 'arrow', 'pixelate', 'circle', 'triangle', 'diamond', 'line', 'highlighter'].includes(el.type)) {
         if (el.type === 'highlighter' && (!el.highlighterStyle || el.highlighterStyle === 'brush')) {
             // Brush highlighter no rotation support yet
         } else {
            const cx = bx + bw / 2;
            const cy = by + bh / 2;
            const dx = x - cx;
            const dy = y - cy;
            const cos = Math.cos(-el.rotation);
            const sin = Math.sin(-el.rotation);
            const rx = dx * cos - dy * sin;
            const ry = dx * sin + dy * cos;
            x = rx + cx;
            y = ry + cy;
         }
    }

    if (el.type === 'rect' || el.type === 'image' || el.type === 'text' || el.type === 'arrow' || el.type === 'pixelate') {
        const padding = 5;
        return x >= bx - padding && x <= bx + bw + padding && y >= by - padding && y <= by + bh + padding;
    }
    else if (el.type === 'highlighter' && el.highlighterStyle === 'rect') {
        const padding = 5;
        return x >= bx - padding && x <= bx + bw + padding && y >= by - padding && y <= by + bh + padding;
    }
    // Circle detection
    else if (el.type === 'circle') {
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const rx = bw / 2;
        const ry = bh / 2;
        const padding = 5;
        const dx = x - cx;
        const dy = y - cy;
        return ((dx*dx)/((rx+padding)*(rx+padding)) + (dy*dy)/((ry+padding)*(ry+padding))) <= 1;
    }
    // Line detection
    else if (el.type === 'line') {
        const padding = Math.max(5, el.strokeWidth);
        const x1 = el.x || 0;
        const y1 = el.y || 0;
        const x2 = x1 + (el.width || 0);
        const y2 = y1 + (el.height || 0);
        
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const ddx = x - xx;
        const ddy = y - yy;
        return (ddx * ddx + ddy * ddy) <= padding * padding;
    }
    // Triangle & Diamond detection
    else if (el.type === 'triangle' || el.type === 'diamond') {
         const path = new Path2D();
         const ox = el.x || 0;
         const oy = el.y || 0;
         const ow = el.width || 0;
         const oh = el.height || 0;

         if (el.type === 'triangle') {
             path.moveTo(ox + ow / 2, oy);
             path.lineTo(ox, oy + oh);
             path.lineTo(ox + ow, oy + oh);
             path.closePath();
         } else {
             path.moveTo(ox + ow / 2, oy);
             path.lineTo(ox + ow, oy + oh / 2);
             path.lineTo(ox + ow / 2, oy + oh);
             path.lineTo(ox, oy + oh / 2);
             path.closePath();
         }
         ctx.lineWidth = Math.max(10, el.strokeWidth + 5);
         return ctx.isPointInPath(path, x, y) || ctx.isPointInStroke(path, x, y);
    }
    else if (el.type === 'stamp') {
        if (el.x !== undefined && el.y !== undefined) {
            const radius = 10 + el.strokeWidth;
            if (el.stampStyle === 'square') {
                return x >= el.x - radius && x <= el.x + radius && y >= el.y - radius && y <= el.y + radius;
            } else {
                const dx = x - el.x;
                const dy = y - el.y;
                return dx*dx + dy*dy <= radius*radius;
            }
        }
        return false;
    }
    else if ((el.type === 'pen' || el.type === 'highlighter') && el.points) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        el.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
        bx = minX; by = minY; bw = maxX - minX; bh = maxY - minY;
        const padding = Math.max(5, el.strokeWidth);
        bx -= padding; by -= padding; bw += padding*2; bh += padding*2;
        return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
    } 

    return false;
};

// Return simple bounding box for an element {x, y, w, h}
export const getElementBounds = (el: DrawingElement) => {
    let bx = el.x || 0;
    let by = el.y || 0;
    let bw = el.width || 0;
    let bh = el.height || 0;

    if (el.type === 'pen' || (el.type === 'highlighter' && (!el.highlighterStyle || el.highlighterStyle === 'brush'))) {
        if (!el.points || el.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        el.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    
    if (el.type === 'stamp') {
        const radius = 10 + el.strokeWidth;
        return { x: bx - radius, y: by - radius, w: radius * 2, h: radius * 2 };
    }

    if (bw < 0) { bx += bw; bw = Math.abs(bw); }
    if (bh < 0) { by += bh; bh = Math.abs(bh); }

    return { x: bx, y: by, w: bw, h: bh };
};

// Check which resize handle is hit
export type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate' | null;

export const getResizeHandleType = (x: number, y: number, el: DrawingElement): ResizeHandleType => {
    if (el.locked) return null;
    // Highlight Brush has no handles
    if (el.type === 'highlighter' && (!el.highlighterStyle || el.highlighterStyle === 'brush')) return null;

    if (!['rect', 'text', 'image', 'arrow', 'pixelate', 'circle', 'triangle', 'diamond', 'line', 'highlighter'].includes(el.type)) return null;
    
    const handleSize = 12; 
    const half = handleSize / 2;
    const padding = 4;

    let bx = el.x || 0;
    let by = el.y || 0;
    let bw = el.width || 0;
    let bh = el.height || 0;
    if (bw < 0) { bx += bw; bw = Math.abs(bw); }
    if (bh < 0) { by += bh; bh = Math.abs(bh); }

    // Apply Inverse Rotation to Mouse Point if element is rotated
    if (el.rotation && el.rotation !== 0) {
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const dx = x - cx;
        const dy = y - cy;
        const cos = Math.cos(-el.rotation);
        const sin = Math.sin(-el.rotation);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        x = rx + cx;
        y = ry + cy;
    }

    const left = bx - padding;
    const right = bx + bw + padding;
    const top = by - padding;
    const bottom = by + bh + padding;
    const midX = bx + bw / 2;
    const midY = by + bh / 2;

    const check = (hx: number, hy: number) => {
        return x >= hx - half && x <= hx + half && y >= hy - half && y <= hy + half;
    };

    if (check(left, top)) return 'nw';
    if (check(midX, top)) return 'n';
    if (check(right, top)) return 'ne';
    if (check(right, midY)) return 'e';
    if (check(right, bottom)) return 'se';
    if (check(midX, bottom)) return 's';
    if (check(left, bottom)) return 'sw';
    if (check(left, midY)) return 'w';

    // Rotation Handle (Top Center - 20px)
    if (check(midX, top - 20)) return 'rotate';

    return null;
}

export const getCursorForHandle = (handle: ResizeHandleType, rotation: number = 0) => {
    switch(handle) {
        case 'n': case 's': return 'ns-resize';
        case 'e': case 'w': return 'ew-resize';
        case 'nw': case 'se': return 'nwse-resize';
        case 'ne': case 'sw': return 'nesw-resize';
        case 'rotate': return 'alias'; 
        default: return 'default';
    }
}
