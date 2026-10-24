// The one drag and drop for every game, on pointer events (mouse, pen and touch).
// A drop target is any element with data-drop="<target id>"; a drop calls the game's own handler for that spot.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';
import { endPress, movePress, releasedUnseen, startPress } from './dragMachine.ts';
import { edgeScrollStep } from './edgeScroll.ts';
import type { Outcome, Point, Press } from './dragMachine.ts';
import { createGhost, moveGhost, returnGhost } from './ghost.ts';
import { markDropped } from './recentDrop.ts';
import { swallowNextClick } from './swallowClick.ts';

export type DragOptions = {
  canLift: (id: string) => boolean;                 // read on every render; false means the element gets no source props
  canDrop: (id: string, target: string) => boolean; // read on every pointer move and at release, from the latest render
  onLift?: (id: string) => void;                    // once the pointer passes DRAG_THRESHOLD_PX: select the piece so its targets light up
  onDrop: (id: string, target: string) => void;     // released over a legal [data-drop] target
  onCancel?: (id: string) => void;                  // released anywhere else, pointercancel, Escape, or canLift(id) turned false mid-drag
};

export type DragSourceProps = {
  'data-drag': string;
  onPointerDown: (event: ReactPointerEvent<Element>) => void;
  onDragStart: (event: ReactDragEvent<Element>) => void; // prevents the browser's own image and text drag
};

export type Drag = {
  source: (id: string) => DragSourceProps | undefined; // spread as {...drag.source(id)}; undefined while canLift(id) is false
  dragging: string | null;                           // the lifted id, null when nothing is lifted
  over: string | null;                               // the legal target under the pointer, null otherwise
};

type Session = {
  press: Press;
  source: Element;
  ghost: HTMLElement | null;
  overElement: Element | null;
  point: Point;              // where the pointer last was
  scrollFrame: number | null; // the pending edge scroll frame, while the pointer is near the top or bottom
  // null ends it silently, as on unmount; released is false when the pointer is still down, so its release click is swallowed later
  end: (outcome: Outcome | null, released?: boolean) => void;
};

function targetAt(point: Point): Element | null {
  return document.elementFromPoint(point.x, point.y)?.closest('[data-drop]') ?? null;
}

// A drag canceled while the pointer is still down (Escape, the piece taken away) must not click on its release either
function swallowReleaseClick(pointerId: number) {
  const onRelease = (up: PointerEvent) => {
    if (up.pointerId !== pointerId) return;
    window.removeEventListener('pointerup', onRelease, true);
    swallowNextClick();
  };
  window.addEventListener('pointerup', onRelease, true);
}

const pointOf = (event: PointerEvent | ReactPointerEvent) => ({ x: event.clientX, y: event.clientY });

export function useDrag(options: DragOptions): Drag {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const session = useRef<Session | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  // A state change while a piece is held (an undo, a turn ending) can take the piece away from this player
  useLayoutEffect(() => {
    const current = session.current;
    if (current && !options.canLift(current.press.id)) current.end(current.press.lifted ? { kind: 'cancel' } : null);
  });

  useEffect(() => () => session.current?.end(null), []);

  const begin = (id: string, event: ReactPointerEvent<Element>) => {
    const press = startPress(session.current?.press ?? null, id, {
      pointerId: event.pointerId, isPrimary: event.isPrimary, button: event.button, point: pointOf(event)
    });
    if (!press || press === session.current?.press) return;
    const source = event.currentTarget;
    const current: Session = { press, source, ghost: null, overElement: null, point: press.start, scrollFrame: null, end };
    session.current = current;

    function setOverElement(element: Element | null) {
      if (element === current.overElement) return;
      current.overElement?.removeAttribute('data-drag-over');
      element?.setAttribute('data-drag-over', '');
      current.overElement = element;
      setOver(element?.getAttribute('data-drop') ?? null);
    }

    function updateOver() {
      const element = targetAt(current.point);
      const target = element?.getAttribute('data-drop');
      setOverElement(target != null && latest.current.canDrop(id, target) ? element : null);
    }

    // Scrolls the window a step each frame while the pointer stays near its top or bottom edge, until it cannot go further
    function edgeScroll() {
      current.scrollFrame = null;
      const step = edgeScrollStep(current.point.y, window.innerHeight);
      if (step === 0) return;
      const before = window.scrollY;
      window.scrollBy(0, step);
      if (window.scrollY === before) return;
      updateOver(); // the page moved under a still pointer
      current.scrollFrame = requestAnimationFrame(edgeScroll);
    }

    function onMove(move: PointerEvent) {
      if (move.pointerId !== current.press.pointerId) return;
      if (releasedUnseen(move.pointerType, move.buttons)) { abandon(); return; }
      current.point = pointOf(move);
      const wasLifted = current.press.lifted;
      current.press = movePress(current.press, move.pointerId, current.point);
      if (!current.press.lifted) return;
      if (!wasLifted) {
        // Made where the press began, so the grab offset is where the piece was taken, however far the first move jumped
        current.ghost = createGhost(source, current.press.start);
        source.setAttribute('data-dragging', '');
        setDragging(id);
        window.addEventListener('keydown', onKey);
        latest.current.onLift?.(id);
      }
      moveGhost(current.ghost!, current.point);
      updateOver();
      if (current.scrollFrame === null) edgeScroll();
    }

    function onUp(up: PointerEvent) {
      if (up.pointerId !== current.press.pointerId) return;
      const target = current.press.lifted ? targetAt(pointOf(up))?.getAttribute('data-drop') ?? null : null;
      end(endPress(current.press, target, latest.current.canDrop), true);
    }

    // Ends the press with no target and no release still to come: pointercancel, a mouse released unseen, the window losing focus
    function abandon() {
      end(endPress(current.press, null, latest.current.canDrop), true);
    }

    function onCancelPointer(cancel: PointerEvent) {
      if (cancel.pointerId === current.press.pointerId) abandon();
    }

    function onKey(key: KeyboardEvent) {
      if (key.key !== 'Escape') return;
      key.preventDefault();
      end({ kind: 'cancel' });
    }

    function end(outcome: Outcome | null, released = false) {
      if (session.current !== current) return;
      session.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancelPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', abandon);
      if (current.scrollFrame !== null) cancelAnimationFrame(current.scrollFrame);
      source.removeAttribute('data-dragging');
      current.overElement?.removeAttribute('data-drag-over');
      if (!current.press.lifted) return;
      if (released) swallowNextClick();
      else swallowReleaseClick(current.press.pointerId);
      if (outcome === null) { current.ghost?.remove(); return; }
      setDragging(null);
      setOver(null);
      if (outcome.kind === 'drop') {
        current.ghost?.remove();
        markDropped();
        latest.current.onDrop(id, outcome.target);
      } else {
        returnGhost(current.ghost!, source);
        latest.current.onCancel?.(id);
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancelPointer);
    window.addEventListener('blur', abandon);
  };

  const source = (id: string): DragSourceProps | undefined => options.canLift(id) ? {
    'data-drag': id,
    onPointerDown: event => begin(id, event),
    onDragStart: event => event.preventDefault()
  } : undefined;

  return { source, dragging, over };
}
