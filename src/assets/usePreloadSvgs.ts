import { useEffect } from 'react';
import { preloadSvgs } from './svgCache.ts';

// Fetches every piece a screen may show as soon as it mounts, so a piece that appears mid-game is already drawn.
// Pass a constant list (made once per module), so it runs once per mount
export default function usePreloadSvgs(urls: string[]): void {
  useEffect(() => {
    void preloadSvgs(urls);
  }, [urls]);
}
