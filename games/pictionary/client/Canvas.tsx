import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import gameService from '../../../src/services/gameService';
import { CANVAS_H, CANVAS_W } from '../clock.ts';
import { createBatcher } from './batcher.ts';
import { drawLine, paint } from './paint.ts';
import { countedStrokeId, echoed } from './strokeSync.ts';
import type { Line } from './paint.ts';
import type { Stroke, Tool } from '../types.ts';

export type Pen = { tool: Tool | 'fill'; color: number; size: 0 | 1 | 2 };

type CanvasProps = {
  strokes: Stroke[];
  pen?: Pen; // only for the drawer while drawing; without it the canvas is read only
  nextStrokeId?: number;
  error?: string | null;
};

// Pointer position in canvas units, kept on the paper while the pointer is captured outside it
function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value)));
  return [clamp((event.clientX - rect.left) * CANVAS_W / rect.width, CANVAS_W), clamp((event.clientY - rect.top) * CANVAS_H / rect.height, CANVAS_H)];
}

// Read back for every fill, so the browser keeps the pixels where reading them is quick
const context2d = (canvas: HTMLCanvasElement | null) => canvas?.getContext('2d', { willReadFrequently: true });

// The drawing, 4:3 and scaled to its box. Mouse, touch and pen all draw through the same pointer events
export default function Canvas({ strokes, pen, nextStrokeId = 1, error = null }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef(strokes);
  const penRef = useRef(pen);
  // The drawer's last stroke sent, kept until a state has caught up with it; a line in progress is painted at once
  const local = useRef<Stroke | null>(null);
  const batcher = useRef<ReturnType<typeof createBatcher> | null>(null);
  // The id the server will give the next stroke
  const nextId = useRef(nextStrokeId);

  const repaint = useCallback(() => {
    const ctx = context2d(canvasRef.current);
    if (!ctx) return;
    paint(ctx, strokesRef.current);
    if (local.current?.kind === 'line') drawLine(ctx, local.current);
  }, []);

  useEffect(() => {
    penRef.current = pen;
    if (!pen && local.current) { batcher.current = null; local.current = null; repaint(); }
  }, [pen, repaint]);

  useEffect(() => {
    strokesRef.current = strokes;
    const mine = local.current;
    if (mine && !batcher.current && echoed(mine, strokes, nextStrokeId)) local.current = null;
    nextId.current = countedStrokeId(nextId.current, nextStrokeId, local.current !== null);
    repaint();
  }, [strokes, nextStrokeId, repaint]);

  // A refused stroke or extend never shows in a state, so stop showing it here
  useEffect(() => {
    if (error && local.current && !batcher.current) { local.current = null; repaint(); }
  }, [error, repaint]);

  function add(line: Line, x: number, y: number) {
    const { points } = line;
    if (points.length > 0 && points[points.length - 2] === x && points[points.length - 1] === y) return;
    points.push(x, y);
    batcher.current?.add(x, y);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!pen || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    // A refusal still showing (a state clears it) means what was sent since the last state was not taken,
    // whether or not the same refusal came twice
    if (error) local.current = null;
    nextId.current = countedStrokeId(nextId.current, nextStrokeId, local.current !== null);
    const id = nextId.current++;
    const [x, y] = canvasPoint(event.currentTarget, event.nativeEvent);
    if (pen.tool === 'fill') {
      // A fill starts on a pixel, so the far edge is the last pixel, not the edge's coordinate
      const fill = { color: pen.color, x: Math.min(x, CANVAS_W - 1), y: Math.min(y, CANVAS_H - 1) };
      local.current = { id, kind: 'fill', ...fill };
      gameService.sendAction({ type: 'fill', ...fill });
      return;
    }
    // The eraser paints white, the paper's color
    const { tool, size } = pen;
    const color = tool === 'eraser' ? 1 : pen.color;
    const line: Line = { id, kind: 'line', tool, color, size, points: [] };
    local.current = line;
    let first = true;
    batcher.current = createBatcher(points => {
      if (!penRef.current) return; // the turn ended mid-stroke
      gameService.sendAction(first ? { type: 'stroke', tool, color, size, points } : { type: 'extend', id, points });
      first = false;
    });
    add(line, x, y);
    const ctx = context2d(canvasRef.current);
    if (ctx) drawLine(ctx, line);
  }

  // Only the new points are drawn, on top of what is painted; a full repaint waits for the next state
  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const line = local.current;
    if (!batcher.current || line?.kind !== 'line') return;
    const canvas = event.currentTarget;
    const before = line.points.length;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const each of events.length > 0 ? events : [event.nativeEvent]) add(line, ...canvasPoint(canvas, each));
    const ctx = context2d(canvasRef.current);
    if (ctx && line.points.length > before) drawLine(ctx, line, before);
  }

  function onPointerUp() {
    batcher.current?.flush();
    batcher.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={pen ? 'pictionary-canvas pictionary-canvas-drawing' : 'pictionary-canvas'}
      width={CANVAS_W}
      height={CANVAS_H}
      role="img"
      aria-label="Drawing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
