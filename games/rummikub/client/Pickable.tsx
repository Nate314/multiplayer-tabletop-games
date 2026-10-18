import type { DragEvent, KeyboardEvent, ReactNode } from 'react';
import { allowDrop } from './dragDrop.ts';

type PickableProps = {
  label: string;
  className: string;
  title?: string;
  onActivate: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  children: ReactNode;
};

// A tile or group handle that can be clicked or dragged. It is a span with the button role rather than a <button>,
// because Firefox does not drag a draggable <button>. Enter and Space click it, as they would a button.
export default function Pickable({ label, className, title, onActivate, onDragStart, onDragEnd, onDrop, children }: PickableProps) {
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
      draggable
      onClick={onActivate}
      onKeyDown={keyDown}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDrop && allowDrop}
      onDrop={onDrop}
    >
      {children}
    </span>
  );
}
