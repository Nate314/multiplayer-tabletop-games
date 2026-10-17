import { useState, useEffect } from 'react';

const STORAGE_KEY = 'theme';

export default function ThemeToggle() {
  // index.html applies the saved theme before first paint; this keeps it in sync afterwards.
  // Reading it back from the page keeps the choice across screens even when storage is blocked.
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage is blocked; the theme lasts until the page goes away
    }
  }, [theme]);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
