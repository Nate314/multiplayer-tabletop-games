// Swallows the click the browser fires right after a drag ends, so ending a drag never also clicks what is under it.
// Capture phase and once only; cleared on the next tick if no click came.
export function swallowNextClick(): void {
  const swallow = (click: MouseEvent) => { click.stopPropagation(); click.preventDefault(); };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
}
