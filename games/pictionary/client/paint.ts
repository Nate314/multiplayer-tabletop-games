import { BRUSH_SIZES, CANVAS_H, CANVAS_W, PALETTE } from '../clock.ts';
import { floodFill } from './fill.ts';
import type { Stroke } from '../types.ts';

export type Line = Extract<Stroke, { kind: 'line' }>;

function rgba(hex: string): [number, number, number, number] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(255) as [number, number, number, number];
}

// One line, or only its points from index `start` on, joined to the point before so a line can grow in pieces
export function drawLine(ctx: CanvasRenderingContext2D, stroke: Line, start = 0): void {
  const { points } = stroke;
  const from = Math.max(0, start - 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.tool === 'eraser' ? PALETTE[1] : PALETTE[stroke.color];
  ctx.lineWidth = BRUSH_SIZES[stroke.size];
  ctx.beginPath();
  ctx.moveTo(points[from], points[from + 1]);
  // A single point still draws a dot: a zero-length line with round caps
  if (points.length - from === 2) ctx.lineTo(points[from], points[from + 1]);
  for (let i = from + 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.stroke();
}

// Repaints the whole drawing from its strokes, on white paper whatever the page theme.
// shortcut: each new state repaints from scratch, a full-canvas pass per fill, upgrade to painting only new strokes if drawing lags
export function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  ctx.fillStyle = PALETTE[1];
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  for (const stroke of strokes) {
    if (stroke.kind === 'line') {
      drawLine(ctx, stroke);
      continue;
    }
    const image = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    floodFill(image.data, CANVAS_W, CANVAS_H, stroke.x, stroke.y, rgba(PALETTE[stroke.color]));
    ctx.putImageData(image, 0, 0);
  }
}
