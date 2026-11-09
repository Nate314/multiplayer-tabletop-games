// data-anim-key values, shared by the board and its move animation
export const tileKey = (index: number) => `tile-${index}`;
export const meepleKey = (index: number) => `meeple-${index}`;

// data-drop ids of the squares and meeple circles a drag can end on
export const cellTarget = (cell: { x: number; y: number }) => `cell-${cell.x},${cell.y}`;
export const spotTarget = (feature: { kind: string; index: number }) => `spot-${feature.kind}-${feature.index}`;
