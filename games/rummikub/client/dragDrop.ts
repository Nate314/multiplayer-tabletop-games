import type { DragEvent } from 'react';

// Lets an element take a drop
export function allowDrop(event: DragEvent) {
  event.preventDefault();
}
