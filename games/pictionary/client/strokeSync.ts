import type { Stroke } from '../types.ts';

// Whether a state has caught up with a stroke this browser sent: its copy holds every point, or its id was used and
// the stroke is gone (taken back or cleared)
export function echoed(sent: Stroke, strokes: Stroke[], nextStrokeId: number): boolean {
  const copy = strokes.find(stroke => stroke.id === sent.id);
  if (!copy) return nextStrokeId > sent.id;
  return copy.kind !== 'line' || sent.kind !== 'line' || copy.points.length >= sent.points.length;
}

// The id the server will give the next stroke: counted ahead while a sent stroke is unechoed, else the server's,
// which follows it down after an undo vote restores a lower one
export function countedStrokeId(counted: number, nextStrokeId: number, unechoed: boolean): number {
  return unechoed ? Math.max(counted, nextStrokeId) : nextStrokeId;
}
