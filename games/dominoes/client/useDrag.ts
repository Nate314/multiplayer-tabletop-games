// shortcut: a local copy of the drag and drop PR's src/drag/useDrag.ts interface; replace with that import when the branches merge
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';

export type DragOptions = {
  canLift: (id: string) => boolean;
  canDrop: (id: string, target: string) => boolean;
  onLift?: (id: string) => void;
  onDrop: (id: string, target: string) => void;
  onCancel?: (id: string) => void;
};
export type DragSourceProps = {
  'data-drag': string;
  onPointerDown: (event: ReactPointerEvent<Element>) => void;
  onDragStart: (event: ReactDragEvent<Element>) => void;
};
export type Drag = { source: (id: string) => DragSourceProps | undefined; dragging: string | null; over: string | null };

export const DRAG_THRESHOLD_PX = 6;

// Pointer based, so mouse, pen and touch share one path. A press that moves less than the threshold stays a click.
export function useDrag(options: DragOptions): Drag {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const stop = useRef<(() => void) | null>(null);

  // Removes the listeners, the clone and the marks of a drag in progress
  useEffect(() => () => stop.current?.(), []);

  const press = useCallback((id: string, event: ReactPointerEvent<Element>) => {
    if (event.button !== 0 || !event.isPrimary || !latest.current.canLift(id)) return;
    stop.current?.();
    const element = event.currentTarget as HTMLElement;
    const { clientX: startX, clientY: startY } = event;
    const grab = element.getBoundingClientRect();
    let ghost: HTMLElement | null = null;
    let target: string | null = null;
    let marked: Element | null = null;
    let lifted = false;

    const mark = (next: Element | null) => {
      marked?.removeAttribute('data-drag-over');
      next?.setAttribute('data-drag-over', '');
      marked = next;
    };
    const swallowClick = (click: Event) => click.stopPropagation();
    const finish = (drop: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
      stop.current = null;
      if (!lifted) return;
      ghost?.remove();
      mark(null);
      element.removeAttribute('data-dragging');
      // The click that follows a drag must not play the tile
      window.addEventListener('click', swallowClick, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallowClick, { capture: true }), 0);
      setDragging(null);
      setOver(null);
      if (drop && target !== null) latest.current.onDrop(id, target);
      else latest.current.onCancel?.(id);
    };
    const move = (e: PointerEvent) => {
      if (!lifted) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD_PX) return;
        lifted = true;
        ghost = element.cloneNode(true) as HTMLElement;
        ghost.classList.add('drag-ghost');
        ghost.removeAttribute('data-drag');
        ghost.removeAttribute('data-anim-key'); // the animations look tiles up by it
        ghost.style.width = `${grab.width}px`;
        ghost.style.height = `${grab.height}px`;
        (element.closest('[data-game]') ?? document.body).appendChild(ghost);
        element.setAttribute('data-dragging', '');
        setDragging(id);
        latest.current.onLift?.(id);
      }
      if (ghost) ghost.style.transform = `translate(${grab.left + e.clientX - startX}px, ${grab.top + e.clientY - startY}px)`;
      const slot = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop]') ?? null;
      const name = slot?.getAttribute('data-drop') ?? null;
      const legal = slot !== null && name !== null && latest.current.canDrop(id, name);
      target = legal ? name : null;
      mark(legal ? slot : null);
      setOver(target);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(false); };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    stop.current = () => finish(false);
  }, []);

  const source = useCallback((id: string): DragSourceProps => ({
    'data-drag': id,
    onPointerDown: event => press(id, event),
    onDragStart: event => event.preventDefault()
  }), [press]);

  return { source, dragging, over };
}
