// The floating copy of a lifted piece that follows the pointer
import { prefersReducedMotion, slideFrom } from '../animation/motion.ts';
import type { Point } from './dragMachine.ts';

// Where the pointer grabbed each ghost, relative to its top left corner
const grabOffsets = new WeakMap<HTMLElement, Point>();

// Not copied to the ghost itself: the .drag-ghost rule in App.scss sets these, and the source's own transform would shift it off the grab point
const NOT_COPIED = ['opacity', 'scale', 'filter', 'pointer-events', 'z-index', 'cursor', 'transition', 'animation', 'margin', 'transform', 'translate', 'rotate'];

function copyStyles(from: Element, to: Element) {
  const computed = getComputedStyle(from);
  const style = (to as HTMLElement | SVGElement).style;
  for (let index = 0; index < computed.length; index++) {
    const name = computed[index];
    style.setProperty(name, computed.getPropertyValue(name));
  }
  // The copy must not look like a drag source, a drop target or an animated piece
  for (const attribute of ['id', 'data-drag', 'data-drop', 'data-dragging', 'data-drag-over', 'data-anim-key']) to.removeAttribute(attribute);
  for (let index = 0; index < from.children.length; index++) copyStyles(from.children[index], to.children[index]);
}

function place(ghost: HTMLElement, pointer: Point) {
  const offset = grabOffsets.get(ghost) ?? { x: 0, y: 0 };
  ghost.style.left = `${pointer.x - offset.x}px`;
  ghost.style.top = `${pointer.y - offset.y}px`;
}

export function createGhost(source: Element, pointer: Point): HTMLElement {
  const rect = source.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  copyStyles(source, ghost);
  for (const name of NOT_COPIED) ghost.style.removeProperty(name);
  ghost.classList.add('drag-ghost');
  Object.assign(ghost.style, { position: 'fixed', margin: '0', boxSizing: 'border-box', width: `${rect.width}px`, height: `${rect.height}px` });
  ghost.setAttribute('aria-hidden', 'true');
  grabOffsets.set(ghost, { x: pointer.x - rect.left, y: pointer.y - rect.top });
  place(ghost, pointer);
  (source.closest('[data-game]') ?? document.body).append(ghost);
  return ghost;
}

export function moveGhost(ghost: HTMLElement, pointer: Point): void {
  place(ghost, pointer);
}

// Slides back to the source, then removes itself; at once under reduced motion or when the source is gone
export function returnGhost(ghost: HTMLElement, source: Element): void {
  if (!source.isConnected || prefersReducedMotion()) { ghost.remove(); return; }
  const from = ghost.getBoundingClientRect();
  const home = source.getBoundingClientRect();
  ghost.style.left = `${home.left}px`;
  ghost.style.top = `${home.top}px`;
  const animation = slideFrom(ghost, from);
  if (!animation) { ghost.remove(); return; }
  animation.finished.then(() => ghost.remove(), () => ghost.remove());
}
