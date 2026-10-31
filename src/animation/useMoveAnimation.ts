import { useCallback, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { BasePublicState } from '../../shared/types.ts';
import { takeDrop } from '../drag/recentDrop.ts';

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

// Where the element rests: our own (Web Animations API) animations still running are seeked to their end for the measurement,
// so a piece in the middle of a slide is measured at its place, not where it is drawn
function restingRect(element: Element): DOMRect {
  const running = element.getAnimations().filter(animation =>
    !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition) && animation.playState !== 'finished'
  );
  const times = running.map(animation => animation.currentTime);
  running.forEach(animation => { animation.currentTime = animation.effect?.getComputedTiming().endTime ?? null; });
  const rect = element.getBoundingClientRect();
  running.forEach((animation, index) => { animation.currentTime = times[index]; });
  return rect;
}

function measure(root: HTMLElement): Map<string, DOMRect> {
  const origin = originOf(root);
  const rects = new Map<string, DOMRect>();
  root.querySelectorAll<HTMLElement>('[data-anim-key]').forEach(element => {
    const { x, y, width, height } = restingRect(element);
    rects.set(element.dataset.animKey!, new DOMRect(x - origin.x, y - origin.y, width, height));
  });
  return rects;
}

// Calls animate after the DOM shows the new state but before the browser paints it, only for exactly one new move.
// The first render (also after a refresh or rejoin), a jump of several moves and an undo (fewer moves) snap without animating,
// and so does a move this player just made by dropping the piece where it lands (markDropped in src/drag/recentDrop.ts).
// rectOf(key) is where the element with data-anim-key="<key>" was after the previous render, in the current viewport coordinates.
// A screen that moves pieces itself, without a move, calls the returned function once they are in place, so the next move
// slides them from there rather than from where they were before.
export function useMoveAnimation<P extends BasePublicState>(
  rootRef: RefObject<HTMLElement | null>,
  state: P,
  animate: (change: MoveChange<P>) => void
): () => void {
  const previousRef = useRef<P | null>(null);
  const rectsRef = useRef<Map<string, DOMRect> | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const previous = previousRef.current;
    previousRef.current = state;
    if (!root) {
      rectsRef.current = null;
      return;
    }

    // Measured before animate starts anything, so the stored rects are where the pieces now rest
    const rects = rectsRef.current;
    const nextRects = measure(root);
    try {
      if (previous && rects && state.moveCount === previous.moveCount + 1 && !takeDrop()) {
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
    } finally {
      rectsRef.current = nextRects;
    }
  }, [rootRef, state, animate]);

  // Only when rects are held, so it never lets the first render animate
  return useCallback(() => {
    const root = rootRef.current;
    if (root && rectsRef.current) rectsRef.current = measure(root);
  }, [rootRef]);
}
