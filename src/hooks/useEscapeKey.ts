import { useEffect } from 'react';

// Capture phase, so Escape closes only the topmost dialog and not the join dialog behind it. On the document, so a
// panel inside the dialog (useDismiss, on the window) sees the key first
export default function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onEscape();
    }
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onEscape]);
}
