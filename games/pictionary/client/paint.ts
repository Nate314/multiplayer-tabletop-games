import { BRUSH_SIZES, CANVAS_H, CANVAS_W, PALETTE } from '../clock.ts';
import { floodFill } from './fill.ts';
import type { Stroke } from '../types.ts';

function rgba(hex: string): [number, number, number, number] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(255) as [number, number, number, number];
}

// Repaints the whole drawing from its strokes, on white paper whatever the page theme.
// shortcut: every change repaints from scratch, so many fills cost a full-canvas pass each, upgrade to painting only new strokes if drawing lags
export function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  ctx.fillStyle = PALETTE[1];
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.kind === 'fill') {
      const image = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      floodFill(image.data, CANVAS_W, CANVAS_H, stroke.x, stroke.y, rgba(PALETTE[stroke.color]));
      ctx.putImageData(image, 0, 0);
      continue;
    }
    const { points } = stroke;
    ctx.strokeStyle = stroke.tool === 'eraser' ? PALETTE[1] : PALETTE[stroke.color];
    ctx.lineWidth = BRUSH_SIZES[stroke.size];
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    // A single point still draws a dot: a zero-length line with round caps
    if (points.length === 2) ctx.lineTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.stroke();
  }
}
