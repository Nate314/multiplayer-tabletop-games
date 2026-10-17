import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { BasePublicState } from '../../shared/types.ts';

export type MoveChange<P extends BasePublicState> = {
  previous: P;
  next: P;
  root: HTMLElement;
  rectOf: (key: string) => DOMRect | undefined;
};

// Rects are kept relative to the root's content, so scrolling the page or the board between two moves does not shift them
function originOf(root: HTMLElement): { x: number; y: number } {
  const rect = root.getBoundingClientRect();
  return { x: rect.x - root.scrollLeft, y: rect.y - root.scrollTop };
}

function measure(root: HTMLElement): Map<string, DOMRect> {
  const origin = originOf(root);
  const rects = new Map<string, DOMRect>();
  root.querySelectorAll<HTMLElement>('[data-anim-key]').forEach(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    rects.set(element.dataset.animKey!, new DOMRect(x - origin.x, y - origin.y, width, height));
  });
  return rects;
}

// Calls animate after the DOM shows the new state but before the browser paints it, only for exactly one new move.
// The first render (also after a refresh or rejoin), a jump of several moves and an undo (fewer moves) snap without animating.
// rectOf(key) is where the element with data-anim-key="<key>" was after the previous render, in the current viewport coordinates.
export function useMoveAnimation<P extends BasePublicState>(
  rootRef: RefObject<HTMLElement | null>,
  state: P,
  animate: (change: MoveChange<P>) => void
): void {
  const previousRef = useRef<P | null>(null);
  const rectsRef = useRef<Map<string, DOMRect> | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const previous = previousRef.current;
    previousRef.current = state;
    if (!root) return;

    const rects = rectsRef.current;
    if (previous && rects && state.moveCount === previous.moveCount + 1) {
      const origin = originOf(root);
      animate({
        previous,
        next: state,
        root,
        rectOf: (key) => {
          const rect = rects.get(key);
          return rect && new DOMRect(rect.x + origin.x, rect.y + origin.y, rect.width, rect.height);
        }
      });
    }
    rectsRef.current = measure(root);
  }, [rootRef, state, animate]);
}
