const EDGE_PX = 8;

// A ref callback: slides an absolutely placed element left until its right edge is inside the viewport
export function keepOnScreen(el: HTMLElement | null): void {
  if (!el) return;
  el.style.transform = '';
  const overflow = el.getBoundingClientRect().right - (document.documentElement.clientWidth - EDGE_PX);
  if (overflow > 0) el.style.transform = `translateX(${-overflow}px)`;
}
