// The pure state of one press: when it becomes a drag and how it ends. useDrag drives it from pointer events.
export const DRAG_THRESHOLD_PX = 6;

export type Point = { x: number; y: number };
export type PointerInfo = { pointerId: number; isPrimary: boolean; button: number; point: Point };
export type Press = { id: string; pointerId: number; start: Point; lifted: boolean };
export type Outcome = { kind: 'tap' } | { kind: 'drop'; target: string } | { kind: 'cancel' };

// The press to keep: `current` while one is held, null for a non-primary pointer or a button other than 0
export function startPress(current: Press | null, id: string, pointer: PointerInfo): Press | null {
  if (current) return current;
  if (!pointer.isPrimary || pointer.button !== 0) return null;
  return { id, pointerId: pointer.pointerId, start: pointer.point, lifted: false };
}

// Lifted once the pointer is DRAG_THRESHOLD_PX or more from the start, and stays lifted; other pointers change nothing
export function movePress(press: Press, pointerId: number, point: Point): Press {
  if (pointerId !== press.pointerId || press.lifted) return press;
  if (Math.hypot(point.x - press.start.x, point.y - press.start.y) < DRAG_THRESHOLD_PX) return press;
  return { ...press, lifted: true };
}

// Unlifted: a tap. Lifted: a drop when target is non-null and canDrop(press.id, target), otherwise cancel.
// pointercancel and Escape call it with target null.
export function endPress(press: Press, target: string | null, canDrop: (id: string, target: string) => boolean): Outcome {
  if (!press.lifted) return { kind: 'tap' };
  return target !== null && canDrop(press.id, target) ? { kind: 'drop', target } : { kind: 'cancel' };
}

// A mouse that moves without its main button held was released where the page could not see it (outside the
// window, or over a dialog of the browser's own), so its drag must end
export function releasedUnseen(pointerType: string, buttons: number): boolean {
  return pointerType === 'mouse' && (buttons & 1) === 0;
}
