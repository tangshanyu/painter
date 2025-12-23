
export type ToolType = 'select' | 'pen' | 'highlighter' | 'rect' | 'circle' | 'triangle' | 'diamond' | 'line' | 'arrow' | 'text' | 'stamp' | 'pixelate' | 'crop' | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export type ArrowStyle = 'filled' | 'outline';
export type StampStyle = 'circle' | 'square';
export type PixelateStyle = 'pixel' | 'blur';
export type HighlighterStyle = 'brush' | 'rect';

export interface DrawingElement {
  id: string;
  type: ToolType | 'image'; // Added 'image' as a type for layers
  points?: Point[]; // For pen/highlighter (brush mode)
  x?: number; // For rect/text/image/arrow/stamp/highlighter(rect)
  y?: number; // For rect/text/image/arrow/stamp/highlighter(rect)
  width?: number; // For rect/image/arrow
  height?: number; // For rect/image/arrow
  text?: string; // For text and STAMP (holds the number)
  imageData?: string; // Base64 for image layer
  color: string;
  strokeWidth: number;
  font?: string;
  arrowStyle?: ArrowStyle;
  stampStyle?: StampStyle;
  pixelateStyle?: PixelateStyle;
  highlighterStyle?: HighlighterStyle;
  rotation?: number; // Rotation in radians
  locked?: boolean; // if true, cannot be moved or resized
}

export interface TabData {
  id: string;
  title: string;
  imageDataUrl: string | null; // The background base image
  elements: DrawingElement[]; // The vector layers on top
  history: DrawingElement[][]; // Undo stack
  historyIndex: number; // Current position in undo stack
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
}

export interface ToolSettings {
  color: string;
  strokeWidth: number;
  fontSize: number;
  opacity: number;
  arrowStyle: ArrowStyle;
  stampStyle: StampStyle;
  pixelateStyle: PixelateStyle;
  highlighterStyle: HighlighterStyle;
}
