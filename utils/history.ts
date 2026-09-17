import { DocumentSnapshot, DrawingElement, TabData } from '../types';

type SnapshotOverrides = Partial<Pick<
  DocumentSnapshot,
  'elements' | 'imageDataUrl' | 'canvasWidth' | 'canvasHeight'
>>;

export const createDocumentSnapshot = (
  tab: Pick<TabData, 'elements' | 'imageDataUrl' | 'canvasWidth' | 'canvasHeight'>,
  overrides: SnapshotOverrides = {}
): DocumentSnapshot => ({
  elements: overrides.elements ?? tab.elements,
  imageDataUrl: overrides.imageDataUrl !== undefined ? overrides.imageDataUrl : tab.imageDataUrl,
  canvasWidth: overrides.canvasWidth ?? tab.canvasWidth,
  canvasHeight: overrides.canvasHeight ?? tab.canvasHeight,
});

export const createInitialSnapshot = (
  imageDataUrl: string | null,
  canvasWidth: number,
  canvasHeight: number,
  elements: DrawingElement[] = []
): DocumentSnapshot => ({
  elements,
  imageDataUrl,
  canvasWidth,
  canvasHeight,
});
