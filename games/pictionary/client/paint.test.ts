import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawLine, paint } from './paint.ts';
import { BRUSH_SIZES, CANVAS_H, CANVAS_W, PALETTE } from '../clock.ts';
import type { Stroke } from '../types.ts';

// Records every drawing call and style set, in order
function recorder() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {
    getImageData: (x: number, y: number, w: number, h: number) => {
      calls.push(`getImageData ${x} ${y} ${w} ${h}`);
      return { data: new Uint8ClampedArray(w * h * 4).fill(255) };
    },
    putImageData: () => calls.push('putImageData')
  };
  const ctx = new Proxy(target, {
    get: (obj, key: string) => obj[key] ?? ((...args: unknown[]) => calls.push(`${key} ${args.join(' ')}`.trim())),
    set: (_obj, key: string, value) => { calls.push(`${key}=${value}`); return true; }
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

test('paint draws strokes in order and erases in white', () => {
  const strokes: Stroke[] = [
    { id: 1, kind: 'line', tool: 'pen', color: 2, size: 0, points: [1, 2, 3, 4] },
    { id: 2, kind: 'line', tool: 'eraser', color: 5, size: 2, points: [5, 6] },
    { id: 3, kind: 'fill', color: 6, x: 10, y: 20 }
  ];
  const { ctx, calls } = recorder();
  paint(ctx, strokes);
  assert.deepEqual(calls, [
    'fillStyle=#ffffff', `fillRect 0 0 ${CANVAS_W} ${CANVAS_H}`,
    'lineCap=round', 'lineJoin=round', `strokeStyle=${PALETTE[2]}`, `lineWidth=${BRUSH_SIZES[0]}`, 'beginPath', 'moveTo 1 2', 'lineTo 3 4', 'stroke',
    'lineCap=round', 'lineJoin=round', `strokeStyle=${PALETTE[1]}`, `lineWidth=${BRUSH_SIZES[2]}`, 'beginPath', 'moveTo 5 6', 'lineTo 5 6', 'stroke',
    `getImageData 0 0 ${CANVAS_W} ${CANVAS_H}`, 'putImageData'
  ]);
});

test('drawLine from a point draws only the new points, joined to the one before', () => {
  const { ctx, calls } = recorder();
  drawLine(ctx, { id: 1, kind: 'line', tool: 'pen', color: 0, size: 1, points: [1, 2, 3, 4, 5, 6, 7, 8] }, 4);
  assert.deepEqual(calls.slice(-5), ['beginPath', 'moveTo 3 4', 'lineTo 5 6', 'lineTo 7 8', 'stroke']);
});
