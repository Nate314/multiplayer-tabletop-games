import type { KeyboardEvent, ReactNode } from 'react';
import type { DragSourceProps } from '../../../src/drag/useDrag.ts';

type PickableProps = {
  label: string;
  className: string;
  title?: string;
  onActivate: () => void;
  dragProps?: DragSourceProps; // from useDrag's source(id), while it can be lifted
  dropId?: string;             // its data-drop target id, when something can be put in front of it
  children: ReactNode;
};

// A tile or group handle that can be clicked or dragged. It is a span with the button role, holding a tile face or
// the handle's grip; Enter and Space click it, as they would a button.
export default function Pickable({ label, className, title, onActivate, dragProps, dropId, children }: PickableProps) {
  function keyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate();
  }
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      title={title}
      className={className}
      data-drop={dropId}
      onClick={onActivate}
      onKeyDown={keyDown}
      {...dragProps}
    >
      {children}
    </span>
  );
}
