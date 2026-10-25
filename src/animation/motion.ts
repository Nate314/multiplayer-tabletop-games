// Small Web Animations API helpers shared by every game's move animations
export const MOVE_DURATION_MS = 300;

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Cancel a running animation first, so a fast follow-up move ends in the right place.
// getAnimations() also returns the element's CSS animations and transitions, so those are canceled too.
function cancelAnimations(element: Element) {
  element.getAnimations().forEach(animation => animation.cancel());
}

type Rect = Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>;

function center(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

// The translate that puts an element at `to` back at `from`, center to center.
// Screen pixels are divided by `scale`, as a translate inside a board scaled down by `scale` moves that much less on screen.
export function slideOffset(from: Rect, to: Rect, scale: number): { x: number; y: number } {
  const start = center(from);
  const end = center(to);
  return { x: (start.x - end.x) / scale, y: (start.y - end.y) / scale };
}

// The scale of the board the element is drawn in: a board scaled to fit (the History board) carries it in data-fit-scale.
// Screen-pixel distances inside that board are divided by it, as a translate there moves that much less on screen.
export function boardScale(element: Element): number {
  return Number(element.closest<HTMLElement>('[data-fit-scale]')?.dataset.fitScale ?? 1);
}

// Moves the element from where `from` is to where it is now, center to center, so a pawn can start from its old square.
// Inside a board scaled to fit, the distance is divided by the board's scale.
// Animates `translate`, which adds to any `transform` the element's CSS already has.
// A delayed slide waits at `from`, so pieces can follow one another.
// Returns the animation, or null when reduced motion skips it.
export function slideFrom(element: Element, from: DOMRect, durationMs = MOVE_DURATION_MS, delayMs = 0): Animation | null {
  cancelAnimations(element);
  if (prefersReducedMotion()) return null;
  const { x, y } = slideOffset(from, element.getBoundingClientRect(), boardScale(element));
  return element.animate(
    [{ translate: `${x}px ${y}px` }, { translate: '0 0' }],
    { duration: durationMs, delay: delayMs, easing: 'ease-in-out', fill: 'backwards' }
  );
}

export function fadeIn(element: Element, durationMs = MOVE_DURATION_MS): void {
  cancelAnimations(element);
  if (prefersReducedMotion()) return;
  element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: durationMs, easing: 'ease-out' });
}

// A brief brightness pulse, to point at an element that did something without moving
export function flash(element: Element, durationMs = MOVE_DURATION_MS * 2): void {
  cancelAnimations(element);
  if (prefersReducedMotion()) return;
  element.animate(
    [{ filter: 'brightness(1)' }, { filter: 'brightness(1.6)', offset: 0.3 }, { filter: 'brightness(1)' }],
    { duration: durationMs, easing: 'ease-out' }
  );
}

// Shows `ghost` (a copy of something that left the page) fixed where `from` was, sized like it, and slides it
// center to center onto `to` while it fades out. It is removed when it finishes or is canceled.
// A delayed ghost waits at `from`. Under reduced motion nothing is added.
export function ghostSlide(root: HTMLElement, ghost: HTMLElement, from: DOMRect, to: DOMRect, delayMs = 0): void {
  if (prefersReducedMotion()) return;
  Object.assign(ghost.style, {
    position: 'fixed', left: `${from.x}px`, top: `${from.y}px`, width: `${from.width}px`, height: `${from.height}px`,
    pointerEvents: 'none', zIndex: '10'
  });
  // Outside the History board's scaled content, as a transformed ancestor would place and scale a fixed element itself
  (root.closest('.history-board') ?? root).appendChild(ghost);
  const start = center(from);
  const end = center(to);
  ghost.animate(
    [{ translate: '0 0', opacity: 1 }, { translate: `${end.x - start.x}px ${end.y - start.y}px`, opacity: 0 }],
    { duration: MOVE_DURATION_MS, delay: delayMs, easing: 'ease-in', fill: 'both' }
  ).finished.then(() => ghost.remove(), () => ghost.remove());
}

// A short roll for a die: a full turn and a hop. Animates `rotate` and `translate`, so any `transform` the element has stays.
export function tumble(element: Element, durationMs = MOVE_DURATION_MS): void {
  cancelAnimations(element);
  if (prefersReducedMotion()) return;
  element.animate(
    [
      { rotate: '0deg', translate: '0 0' },
      { rotate: '180deg', translate: '0 -14px', offset: 0.5 },
      { rotate: '360deg', translate: '0 0' }
    ],
    { duration: durationMs, easing: 'ease-in-out' }
  );
}
