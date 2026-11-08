import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import useDismiss from '../hooks/useDismiss.ts';

// The game header's controls behind one ☰ button. The panel stays mounted so it can animate closed
export default function GameMenu({ attention, children }: { attention: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    // The panel turns inert, so focus inside it would be lost
    if (panelRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
    setOpen(false);
  }, []);
  useDismiss(menuRef, open, dismiss);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('button:enabled, a')?.focus();
  }, [open]);

  // Choosing a control closes the menu, except Share, whose status and copy-by-hand panel hang under its row
  const choose = (event: MouseEvent) => {
    const target = event.target as Element;
    if (target.closest('button, a') && !target.closest('.share-wrapper')) dismiss();
  };

  return (
    <div className="game-menu" ref={menuRef}>
      <button type="button" ref={buttonRef} className="game-menu-button" aria-label="Menu" aria-expanded={open} aria-controls={panelId}
        data-attention={attention ? '' : undefined} onClick={() => (open ? dismiss() : setOpen(true))}>
        ☰
      </button>
      <div id={panelId} ref={panelRef} className="game-menu-panel" data-open={open ? '' : undefined} inert={!open} onClick={choose}>
        {children}
      </div>
    </div>
  );
}
