
export type ToolType = 'select' | 'hand' | 'pen' | 'highlighter' | 'rect' | 'circle' | 'triangle' | 'diamond' | 'line' | 'arrow' | 'text' | 'callout' | 'stamp' | 'symbol' | 'spotlight' | 'pixelate' | 'crop' | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export type ArrowStyle = 'filled' | 'outline';
export type StampStyle = 'circle' | 'square' | 'rounded' | 'diamond' | 'plain';
export type PixelateStyle = 'pixel' | 'blur';
export type HighlighterStyle = 'brush' | 'rect';
export type TextAlignment = 'left' | 'center' | 'right';
export type CalloutTail = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
export type SpotlightShape = 'rect' | 'ellipse';
export type ToolSizeMap = Partial<Record<ToolType, number>>;

export interface DrawingElement {
  id: string;
  name?: string;
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
  fontSize?: number; // Text size in canvas pixels; legacy text falls back to strokeWidth * 6
  arrowStyle?: ArrowStyle;
  stampStyle?: StampStyle;
  stampSize?: number; // Stamp diameter in canvas pixels
  symbol?: string; // Symbol or emoji rendered by the symbol tool
  opacity?: number;
  hidden?: boolean;
  textAlign?: TextAlignment;
  lineHeight?: number;
  calloutTail?: CalloutTail;
  spotlightShape?: SpotlightShape;
  spotlightOpacity?: number;
  pixelateStyle?: PixelateStyle;
  highlighterStyle?: HighlighterStyle;
  rotation?: number; // Rotation in radians
  locked?: boolean; // if true, cannot be moved or resized
}

export interface DocumentSnapshot {
  elements: DrawingElement[];
  imageDataUrl: string | null;
  canvasWidth: number;
  canvasHeight: number;
}

export interface TabData {
  id: string;
  title: string;
  imageDataUrl: string | null; // The background base image
  elements: DrawingElement[]; // The vector layers on top
  history: DocumentSnapshot[]; // Undo stack for the complete document state
  historyIndex: number; // Current position in undo stack
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
}

export interface ToolSettings {
  color: string;
  strokeWidth: number;
  fontSize: number;
  toolSizes: ToolSizeMap;
  opacity: number;
  arrowStyle: ArrowStyle;
  stampStyle: StampStyle;
  symbol: string;
  pixelateStyle: PixelateStyle;
  highlighterStyle: HighlighterStyle;
}
