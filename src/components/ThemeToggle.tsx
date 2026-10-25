import { useSyncExternalStore } from 'react';
import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';

const STORAGE_KEY = 'theme';

type Theme = 'light' | 'dark';

// index.html applies the saved theme before first paint. Every toggle reads the theme back from the page, so the
// header toggle and the one in Settings (on phones) always agree, even when storage is blocked.
const currentTheme = (): Theme => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  // The browser bar follows the theme; index.html holds each theme's color
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const color = themeColor?.dataset[theme];
  if (themeColor && color) themeColor.content = color;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage is blocked; the theme lasts until the page goes away
  }
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => applyTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
    >
      <ServerSvg url={svgUrl('icon', theme === 'dark' ? 'sun' : 'moon')} className="header-icon" />
    </button>
  );
}
