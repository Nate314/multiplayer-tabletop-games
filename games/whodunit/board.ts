// The hotel floor plan. Rooms are letters a to i in ROOMS order, '.' is corridor, '#' is blocked.
// Three rooms across and down, joined by two-cell corridors with a one-cell ring around the edge.
import { ROOMS } from './content.ts';
import type { RoomId, SuspectId } from './content.ts';

export type Cell = { row: number; col: number };
export type Position = { room: RoomId } | Cell;

const BAND = ['.aaaaa..bbbbb..ccccc.', '.ddddd..eeeee..fffff.', '.ggggg..hhhhh..iiiii.'];
const GAP = '.'.repeat(21);
const rows = (band: string) => Array<string>(5).fill(band);
const LAYOUT: readonly string[] = [GAP, ...rows(BAND[0]), GAP, GAP, ...rows(BAND[1]), GAP, GAP, ...rows(BAND[2]), GAP];

export const ROWS = LAYOUT.length;
export const COLS = LAYOUT[0].length;

const at = ({ row, col }: Cell): string => LAYOUT[row]?.[col] ?? '#';

export const isCorridor = (cell: Cell): boolean => at(cell) === '.';

export function roomAt(cell: Cell): RoomId | null {
  const letter = at(cell);
  return letter === '.' || letter === '#' ? null : ROOMS[letter.charCodeAt(0) - 97].id;
}

export const ROOM_CELLS = Object.fromEntries(ROOMS.map(r => [r.id, [] as Cell[]])) as Record<RoomId, Cell[]>;
LAYOUT.forEach((line, row) => [...line].forEach((_, col) => {
  const room = roomAt({ row, col });
  if (room) ROOM_CELLS[room].push({ row, col });
}));

// Cells are (row, col); each door sits on a room's edge and `outside` is the corridor cell in front of it
const door = (room: RoomId, row: number, col: number): { room: RoomId; outside: Cell } => ({ room, outside: { row, col } });
export const DOORS: readonly { room: RoomId; outside: Cell }[] = [
  door('boathouse', 3, 6), door('boathouse', 6, 3),
  door('grand-foyer', 0, 10), door('grand-foyer', 3, 7), door('grand-foyer', 3, 13), door('grand-foyer', 6, 10),
  door('sun-terrace', 3, 14), door('sun-terrace', 6, 17),
  door('salt-spa', 10, 6), door('salt-spa', 7, 3), door('salt-spa', 13, 3),
  door('chart-room', 10, 7), door('chart-room', 7, 10), door('chart-room', 10, 13), door('chart-room', 13, 10),
  door('signal-room', 10, 14), door('signal-room', 7, 17), door('signal-room', 13, 17),
  door('galley', 14, 3), door('galley', 17, 6),
  door('card-parlor', 17, 7), door('card-parlor', 14, 10), door('card-parlor', 20, 10), door('card-parlor', 17, 13),
  door('wine-cellar', 14, 17), door('wine-cellar', 17, 14)
];

export const PASSAGES: Readonly<Partial<Record<RoomId, RoomId>>> = {
  boathouse: 'wine-cellar', 'wine-cellar': 'boathouse',
  'sun-terrace': 'galley', galley: 'sun-terrace'
};

const start = (row: number, col: number): Cell => ({ row, col });
export const STARTS: Readonly<Record<SuspectId, Cell>> = {
  'commodore-brine': start(0, 7),
  'madame-coral': start(0, 13),
  'doctor-tidewell': start(7, 20),
  'miss-gull': start(13, 20),
  'professor-kelp': start(20, 13),
  'baroness-pearl': start(20, 7)
};
