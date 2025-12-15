import React from 'react';
import { DrawingElement, Point, ArrowStyle } from '../types';
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

// Helper function to wrap text
const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let testLine = '';
    let testWidth = 0;
    let currentY = y;

    // If box is too small, just draw what fits or let it overflow slightly
    if (maxWidth < 20) maxWidth = 20;

    for(let n = 0; n < words.length; n++) {
        testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, currentY);
};

// Helper to draw an arrow
const drawArrow = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    w: number, 
    h: number, 
    strokeWidth: number,
    style: ArrowStyle = 'filled'
) => {
    const headLength = 15 + strokeWidth * 2; 
    const startX = x;
    const startY = y;
    const endX = x + w;
    const endY = y + h;
    
    const angle = Math.atan2(endY - startY, endX - startX);
    
    // Draw Shaft (Line)
    // We stop the line a bit before the end so it doesn't poke through the hollow head
    const lineEndOffset = style === 'outline' ? headLength * 0.8 : 0;
    const lineEndX = endX - lineEndOffset * Math.cos(angle);
    const lineEndY = endY - lineEndOffset * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.stroke();

    // Draw Arrow Head
    ctx.beginPath();
    // Tip
    ctx.moveTo(endX, endY);
    // Left corner
    ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
    // Back center (indent) - optional, let's keep it simple triangle for consistency
    // ctx.lineTo(endX - headLength * 0.6 * Math.cos(angle), endY - headLength * 0.6 * Math.sin(angle));
    // Right corner
    ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
    
    ctx.closePath(); // Close the triangle

    if (style === 'filled') {
        ctx.fill();
    } else {
        // Outline
        ctx.fillStyle = 'transparent'; // Or we could clear content? No, transparent is better for overlay
        // To prevent the line from showing inside the head if we didn't offset it correctly, 
        // we can fill with white/background? But that's hard to know.
        // We rely on lineEndOffset above to stop the line short.
        ctx.lineWidth = strokeWidth; // Ensure stroke width matches
        ctx.stroke();
    }
};

const drawStamp = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    color: string,
    strokeWidth: number
) => {
    // Radius based on strokeWidth (reused size logic)
    // small dot (2) -> r=10, large dot (20) -> r=30
    const radius = 10 + strokeWidth; 
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${radius * 1.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + radius * 0.1); // slight offset for visual center
};

export const renderCanvas = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  bgImage: HTMLImageElement | null,
  elements: DrawingElement[],
  activeElement: DrawingElement | null, // Currently drawing element
  selectedElementId: string | null,
  scale: number = 1
) => {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw Background Image
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0);
  } else {
    // Placeholder background if no image
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (elements.length === 0 && !activeElement) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Paste an image (Ctrl+V) to start', canvas.width / 2, canvas.height / 2);
    }
  }

  // Draw Saved Elements
  elements.forEach((el) => {
    drawElement(ctx, el);
    if (el.id === selectedElementId) {
      drawSelectionBorder(ctx, el);
    }
  });

  // Draw Active Element (Ghost/Drawing in progress)
  if (activeElement) {
    drawElement(ctx, activeElement);
    // If drawing a text box, show the box border
    if (activeElement.type === 'text') {
       ctx.save();
       ctx.strokeStyle = '#94a3b8';
       ctx.setLineDash([5, 5]);
       ctx.strokeRect(activeElement.x || 0, activeElement.y || 0, activeElement.width || 0, activeElement.height || 0);
       ctx.restore();
    }
  }
};

const drawSelectionBorder = (ctx: CanvasRenderingContext2D, el: DrawingElement) => {
  ctx.save();
  ctx.strokeStyle = '#3b82f6'; // Brand blue
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  
  const padding = 4;
  let x = el.x || 0;
  let y = el.y || 0;
  let w = el.width || 0;
  let h = el.height || 0;

  // Calculate bounding box for paths
  if ((el.type === 'pen' || el.type === 'highlighter') && el.points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    el.points.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    x = minX;
    y = minY;
    w = maxX - minX;
    h = maxY - minY;
  } else if (el.type === 'stamp') {
      const radius = 10 + el.strokeWidth;
      x = (el.x || 0) - radius;
      y = (el.y || 0) - radius;
      w = radius * 2;
      h = radius * 2;
  }

  // Normalize Rect/Arrow for border drawing (handle negative width/height)
  const drawX = w < 0 ? x + w : x;
  const drawY = h < 0 ? y + h : y;
  const drawW = Math.abs(w);
  const drawH = Math.abs(h);

  // Draw border
  ctx.strokeRect(drawX - padding, drawY - padding, drawW + padding * 2, drawH + padding * 2);
  
  // Draw Resize Handles (8 points)
  // Only for Rect, Text, Image, Arrow
  if (['rect', 'image', 'text', 'arrow'].includes(el.type)) {
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      
      const handleSize = 8;
      const half = handleSize / 2;

      // Positions
      const left = drawX - padding;
      const right = drawX + drawW + padding;
      const top = drawY - padding;
      const bottom = drawY + drawH + padding;
      const midX = drawX + drawW / 2;
      const midY = drawY + drawH / 2;

      const handles = [
          { x: left, y: top }, // NW
          { x: midX, y: top }, // N
          { x: right, y: top }, // NE
          { x: right, y: midY }, // E
          { x: right, y: bottom }, // SE
          { x: midX, y: bottom }, // S
          { x: left, y: bottom }, // SW
          { x: left, y: midY }, // W
      ];

      handles.forEach(hPos => {
          ctx.fillRect(hPos.x - half, hPos.y - half, handleSize, handleSize);
          ctx.strokeRect(hPos.x - half, hPos.y - half, handleSize, handleSize);
      });
  }

  ctx.restore();
}

const drawElement = (ctx: CanvasRenderingContext2D, el: DrawingElement) => {
  ctx.save();
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

  if (el.type === 'pen' || el.type === 'highlighter') {
    if (el.points && el.points.length > 0) {
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i].x, el.points[i].y);
      }
      ctx.stroke();
    }
  } else if (el.type === 'rect') {
    if (el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    }
  } else if (el.type === 'arrow') {
      if (el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
          drawArrow(ctx, el.x, el.y, el.width, el.height, el.strokeWidth, el.arrowStyle || 'filled');
      }
  } else if (el.type === 'stamp') {
      if (el.x !== undefined && el.y !== undefined && el.text) {
          drawStamp(ctx, el.x, el.y, el.text, el.color, el.strokeWidth);
      }
  } else if (el.type === 'text') {
     if (el.x !== undefined && el.y !== undefined && el.text) {
       const fontSize = el.strokeWidth * 6;
       ctx.font = `${fontSize}px sans-serif`; 
       ctx.textBaseline = 'top'; 
       if (el.width) {
           wrapText(ctx, el.text, el.x, el.y, el.width, fontSize * 1.2);
       } else {
           ctx.fillText(el.text, el.x, el.y);
       }
     }
  } else if (el.type === 'image' && el.imageData) {
     const img = getImage(el.imageData);
     if (img && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
         ctx.drawImage(img, el.x, el.y, el.width, el.height);
     } else if (!img && el.x !== undefined) {
         ctx.strokeRect(el.x, el.y!, el.width!, el.height!);
     }
  }

  ctx.restore();
};

export const getMousePos = (canvas: HTMLCanvasElement, evt: React.MouseEvent | MouseEvent): { x: number, y: number } => {
  const rect = canvas.getBoundingClientRect();
  
  // Calculate the scale between the actual CSS size (rect) and the internal canvas size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY
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

// Hit detection
export const isPointInElement = (x: number, y: number, el: DrawingElement, ctx: CanvasRenderingContext2D): boolean => {
    let bx = el.x || 0;
    let by = el.y || 0;
    let bw = el.width || 0;
    let bh = el.height || 0;

    // Normalize negative dimensions
    if (bw < 0) { bx += bw; bw = Math.abs(bw); }
    if (bh < 0) { by += bh; bh = Math.abs(bh); }

    if (el.type === 'rect' || el.type === 'image' || el.type === 'text' || el.type === 'arrow') {
        // use bounding box
        const padding = 5;
        // For arrow, checking the diagonal line is hard, bounding box is acceptable for now
        return x >= bx - padding && x <= bx + bw + padding && y >= by - padding && y <= by + bh + padding;
    }
    else if (el.type === 'stamp') {
        // Circle hit detection
        if (el.x !== undefined && el.y !== undefined) {
            const radius = 10 + el.strokeWidth;
            const dx = x - el.x;
            const dy = y - el.y;
            return dx*dx + dy*dy <= radius*radius;
        }
        return false;
    }
    else if ((el.type === 'pen' || el.type === 'highlighter') && el.points) {
        // Bounding box for paths roughly
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        el.points.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
        bx = minX; by = minY; bw = maxX - minX; bh = maxY - minY;
        const padding = Math.max(5, el.strokeWidth);
        bx -= padding; by -= padding; bw += padding*2; bh += padding*2;
        return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
    } 

    return false;
};

// Check which resize handle is hit
export type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

export const getResizeHandleType = (x: number, y: number, el: DrawingElement): ResizeHandleType => {
    if (!['rect', 'text', 'image', 'arrow'].includes(el.type)) return null;
    
    const handleSize = 12; 
    const half = handleSize / 2;
    const padding = 4;

    let bx = el.x || 0;
    let by = el.y || 0;
    let bw = el.width || 0;
    let bh = el.height || 0;

    // Normalize for hit testing handles
    if (bw < 0) { bx += bw; bw = Math.abs(bw); }
    if (bh < 0) { by += bh; bh = Math.abs(bh); }

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

    return null;
}

export const getCursorForHandle = (handle: ResizeHandleType) => {
    switch(handle) {
        case 'n': case 's': return 'ns-resize';
        case 'e': case 'w': return 'ew-resize';
        case 'nw': case 'se': return 'nwse-resize';
        case 'ne': case 'sw': return 'nesw-resize';
        default: return 'default';
    }
}