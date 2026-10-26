import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import gameService from '../../../src/services/gameService';
import { CANVAS_H, CANVAS_W } from '../clock.ts';
import { createBatcher } from './batcher.ts';
import { paint } from './paint.ts';
import type { Stroke, Tool } from '../types.ts';

export type Pen = { tool: Tool | 'fill'; color: number; size: 0 | 1 | 2 };
type Line = Extract<Stroke, { kind: 'line' }>;

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

// The drawing, 4:3 and scaled to its box. Mouse, touch and pen all draw through the same pointer events
export default function Canvas({ strokes, pen, nextStrokeId = 1, error = null }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef(strokes);
  const penRef = useRef(pen);
  // The drawer's stroke in progress, painted at once and dropped when the server's copy has caught up
  const local = useRef<Line | null>(null);
  const batcher = useRef<ReturnType<typeof createBatcher> | null>(null);
  // The id the server will give the next stroke, counted ahead for strokes sent but not yet echoed
  const nextId = useRef(nextStrokeId);

  const repaint = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const mine = local.current;
    paint(ctx, mine ? [...strokesRef.current.filter(stroke => stroke.id !== mine.id), mine] : strokesRef.current);
  }, []);

  useEffect(() => {
    penRef.current = pen;
    if (!pen) { batcher.current = null; local.current = null; }
  }, [pen]);

  useEffect(() => {
    strokesRef.current = strokes;
    const mine = local.current;
    if (mine && !batcher.current) {
      const copy = strokes.find(stroke => stroke.id === mine.id);
      if (copy ? copy.kind !== 'line' || copy.points.length >= mine.points.length : nextStrokeId > mine.id) local.current = null;
    }
    repaint();
  }, [strokes, nextStrokeId, repaint]);

  // A refused stroke never gets its id, so count again from the server's
  useEffect(() => {
    if (!error) return;
    nextId.current = nextStrokeId;
    if (!batcher.current) { local.current = null; repaint(); }
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  function add(x: number, y: number) {
    const mine = local.current;
    const { points } = mine as Line;
    if (points.length > 0 && points[points.length - 2] === x && points[points.length - 1] === y) return;
    points.push(x, y);
    batcher.current?.add(x, y);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!pen || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    nextId.current = Math.max(nextId.current, nextStrokeId);
    const id = nextId.current++;
    const [x, y] = canvasPoint(event.currentTarget, event.nativeEvent);
    if (pen.tool === 'fill') {
      gameService.sendAction({ type: 'fill', color: pen.color, x, y });
      return;
    }
    // The eraser paints white, the paper's color
    const { tool, size } = pen;
    const color = tool === 'eraser' ? 1 : pen.color;
    local.current = { id, kind: 'line', tool, color, size, points: [] };
    let first = true;
    batcher.current = createBatcher(points => {
      if (!penRef.current) return; // the turn ended mid-stroke
      gameService.sendAction(first ? { type: 'stroke', tool, color, size, points } : { type: 'extend', id, points });
      first = false;
    });
    add(x, y);
    repaint();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!batcher.current) return;
    const canvas = event.currentTarget;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const each of events.length > 0 ? events : [event.nativeEvent]) add(...canvasPoint(canvas, each));
    repaint();
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
