
export type ToolType = 'select' | 'pen' | 'highlighter' | 'rect' | 'arrow' | 'text' | 'stamp';

export interface Point {
  x: number;
  y: number;
}

export type ArrowStyle = 'filled' | 'outline';

export interface DrawingElement {
  id: string;
  type: ToolType | 'image'; // Added 'image' as a type for layers
  points?: Point[]; // For pen/highlighter
  x?: number; // For rect/text/image/arrow
  y?: number; // For rect/text/image/arrow
  width?: number; // For rect/image/arrow (as vector x)
  height?: number; // For rect/image/arrow (as vector y)
  text?: string; // For text and STAMP (holds the number)
  imageData?: string; // Base64 for image layer
  color: string;
  strokeWidth: number;
  font?: string;
  arrowStyle?: ArrowStyle; // New property
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
}