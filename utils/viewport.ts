// Match the editor's p-8 gutter on both sides. Never upscale small images.
export function calculateCanvasFitScale(width: number, height: number, viewportWidth: number, viewportHeight: number): number {
  if (![width, height, viewportWidth, viewportHeight].every(value => Number.isFinite(value) && value > 0)) return 1;
  return Math.min(Math.max(1, viewportWidth - 64) / width, Math.max(1, viewportHeight - 64) / height, 1);
}
