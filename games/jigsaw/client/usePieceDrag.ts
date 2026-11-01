import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { swallowNextClick } from '../../../src/drag/swallowClick.ts';
import type { Piece, Seat } from '../types.ts';

type Point = { x: number; y: number };
export type Dragging = { piece: number; x: number; y: number };
export type PiecePointerProps = { onPointerDown(event: ReactPointerEvent<SVGGElement>): void };

// `matrix` maps table units to the screen (the svg's getScreenCTM); this runs it backwards
export function toTablePoint(matrix: DOMMatrixReadOnly, clientX: number, clientY: number): Point {
  const { a, b, c, d, e, f } = matrix;
  const det = a * d - b * c;
  const x = clientX - e;
  const y = clientY - f;
  return { x: (d * x - c * y) / det, y: (a * y - b * x) / det };
}

// The state says the dragged piece is no longer ours: placed, or taken by someone whose pick-up won
export function lostHold(piece: Piece | undefined, seat: Seat): boolean {
  return !piece || piece.placed || (piece.heldBy !== null && piece.heldBy !== seat);
}

type Options = {
  canLift(piece: number): boolean;
  positionOf(piece: number): Point; // the piece's top left on the table now
  onLift(piece: number): void;
  onDrop(piece: number, x: number, y: number): void;
};

// The pressed piece and how to stop listening for its pointer
type Grab = { piece: number; stop(): void };

// Free placement: press lifts (pickUp at once), moving is local only, release drops at the rounded table point.
// Moves and releases are heard on the window, so reordering the pieces under the pointer never loses the drag
export function usePieceDrag(options: Options) {
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const grab = useRef<Grab | null>(null);
  const latest = useRef(options);
  const bound = useRef(new Map<number, PiecePointerProps>());
  useEffect(() => { latest.current = options; });

  const cancel = useCallback(() => {
    grab.current?.stop();
    grab.current = null;
    setDragging(null);
  }, []);
  useEffect(() => cancel, [cancel]);

  const bind = useCallback((piece: number): PiecePointerProps => {
    const known = bound.current.get(piece);
    if (known) return known;
    const props: PiecePointerProps = {
      onPointerDown(event) {
        if (grab.current || event.button !== 0 || !latest.current.canLift(piece)) return;
        const svg = event.currentTarget.ownerSVGElement;
        const matrix = svg?.getScreenCTM();
        if (!svg || !matrix) return;
        event.preventDefault();
        const pointerId = event.pointerId;
        const pressed = toTablePoint(matrix, event.clientX, event.clientY);
        const start = latest.current.positionOf(piece);
        const at = (moved: PointerEvent): Dragging => {
          const point = toTablePoint(svg.getScreenCTM() ?? matrix, moved.clientX, moved.clientY);
          return { piece, x: point.x - (pressed.x - start.x), y: point.y - (pressed.y - start.y) };
        };
        const onMove = (moved: PointerEvent) => {
          if (moved.pointerId === pointerId) setDragging(at(moved));
        };
        const onEnd = (ended: PointerEvent) => {
          if (ended.pointerId !== pointerId) return;
          const spot = at(ended);
          cancel();
          latest.current.onDrop(piece, Math.round(spot.x), Math.round(spot.y));
          swallowNextClick();
        };
        const stop = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onEnd);
          window.removeEventListener('pointercancel', onEnd);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
        grab.current = { piece, stop };
        setDragging({ piece, ...start });
        latest.current.onLift(piece);
      }
    };
    bound.current.set(piece, props);
    return props;
  }, [cancel]);

  return { dragging, bind, cancel };
}
