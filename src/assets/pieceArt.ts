import { cachedSvg } from './svgCache.ts';

// The DOM twin of <ServerSvg url className="piece-art" />, for a copy built outside React; the drawing is cached
// because the piece it copies was on screen. Inlined like ServerSvg, under the same script policy
export function pieceArt(url: string): HTMLSpanElement {
  const art = document.createElement('span');
  art.className = 'server-svg piece-art';
  art.setAttribute('aria-hidden', 'true');
  art.innerHTML = cachedSvg(url) ?? '';
  return art;
}
