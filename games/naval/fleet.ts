// Fleet geometry and shot text, pure so the browser and the server agree
import type { Random } from '../../shared/types.ts';
import type { Cell, Ship, ShipLength, Shot } from './types.ts';

export const GRID_SIZE = 10;
export const FLEET: readonly ShipLength[] = [5, 4, 3, 3, 2];

const ROW_LETTERS = 'ABCDEFGHIJ';
const FLEET_REFUSAL = 'Place one ship of each length: 5, 4, 3, 3 and 2';

export function cellName(cell: Cell): string {
  return `${ROW_LETTERS[cell.row]}${cell.col + 1}`;
}

export function shipCells(ship: Ship): Cell[] {
  return Array.from({ length: ship.length }, (_, i) => ({
    row: ship.row + (ship.orientation === 'down' ? i : 0),
    col: ship.col + (ship.orientation === 'across' ? i : 0),
  }));
}

// Index of the ship covering `cell`, or -1
export function shipAt(ships: Ship[], cell: Cell): number {
  return ships.findIndex(ship => shipCells(ship).some(c => c.row === cell.row && c.col === cell.col));
}

// Whether `cell` is a whole-numbered square inside the grid
export const onGrid = (cell: Cell) => Number.isInteger(cell.row) && Number.isInteger(cell.col)
  && cell.row >= 0 && cell.row < GRID_SIZE && cell.col >= 0 && cell.col < GRID_SIZE;

// Why these well-formed ships cannot all stand on the grid, or null. Also checks a partial fleet
export function placementError(ships: Ship[]): string | null {
  const taken = new Set<string>();
  for (const ship of ships) {
    const cells = shipCells(ship);
    if (!cells.every(onGrid)) return 'A ship goes off the grid';
    for (const cell of cells) {
      const key = cellName(cell);
      if (taken.has(key)) return 'Ships cannot overlap';
      taken.add(key);
    }
  }
  return null;
}

function isShip(value: unknown): value is Ship {
  if (typeof value !== 'object' || value === null) return false;
  const ship = value as Record<string, unknown>;
  return FLEET.includes(ship.length as ShipLength) && (ship.orientation === 'across' || ship.orientation === 'down')
    && typeof ship.row === 'number' && typeof ship.col === 'number';
}

// Validates an untrusted fleet: one ship of each length, on the grid, not overlapping
export function fleetError(ships: unknown): string | null {
  if (!Array.isArray(ships) || ships.length !== FLEET.length || !ships.every(isShip)) return FLEET_REFUSAL;
  const lengths = ships.map(ship => ship.length).sort((a, b) => b - a);
  if (lengths.some((length, i) => length !== FLEET[i])) return FLEET_REFUSAL;
  return placementError(ships);
}

export function randomFleet(random: Random): Ship[] {
  for (;;) {
    const ships: Ship[] = [];
    for (const length of FLEET) {
      const orientation = random() < 0.5 ? 'across' : 'down';
      const room = GRID_SIZE - length + 1;
      const row = Math.floor(random() * (orientation === 'down' ? room : GRID_SIZE));
      const col = Math.floor(random() * (orientation === 'across' ? room : GRID_SIZE));
      ships.push({ length, row, col, orientation });
    }
    if (placementError(ships) === null) return ships;
  }
}

function shotResult(shot: Shot): string {
  return shot.result === 'sunk' ? `sank a ship of length ${shot.sunkLength}` : shot.result;
}

export function shotsText(shots: Shot[]): string {
  const names = shots.map(cellName);
  const squares = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `${squares}: ${shots.map(shotResult).join(', ')}`;
}
