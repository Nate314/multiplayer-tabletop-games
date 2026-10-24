import { useEffect } from 'react';
import type { RefObject } from 'react';

// While open, a press outside the element or the Escape key dismisses it. Escape is taken in the window's capture phase,
// before useEscapeKey's document listener, so it closes this panel and not the dialog around it.
export default function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return undefined;
    function closeOutside(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onDismiss();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onDismiss();
    }
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [ref, open, onDismiss]);
}
