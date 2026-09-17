import { DrawingElement, TabData } from '../types';

export interface CanvasResizeResult {
  canvasWidth: number;
  canvasHeight: number;
  imageDataUrl: string | null;
  elements: DrawingElement[];
}

const loadImage = (src: string): Promise<HTMLImageElement | null> => new Promise(resolve => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});

export const resizeCanvasDocument = async (
  tab: Pick<TabData, 'canvasWidth' | 'canvasHeight' | 'imageDataUrl' | 'elements'>,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number
): Promise<CanvasResizeResult> => {
  const canvasWidth = Math.max(10, Math.round(width));
  const canvasHeight = Math.max(10, Math.round(height));
  const shiftX = Math.round(offsetX);
  const shiftY = Math.round(offsetY);

  const elements = tab.elements.map(element => {
    const copy = { ...element };
    if (copy.x !== undefined) copy.x += shiftX;
    if (copy.y !== undefined) copy.y += shiftY;
    if (copy.points) {
      copy.points = copy.points.map(point => ({
        x: point.x + shiftX,
        y: point.y + shiftY,
      }));
    }
    return copy;
  });

  let imageDataUrl = tab.imageDataUrl;
  if (tab.imageDataUrl) {
    const image = await loadImage(tab.imageDataUrl);
    if (image) {
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvasWidth, canvasHeight);
        context.drawImage(image, shiftX, shiftY);
        imageDataUrl = canvas.toDataURL('image/png');
      }
    }
  }

  return { canvasWidth, canvasHeight, imageDataUrl, elements };
};
