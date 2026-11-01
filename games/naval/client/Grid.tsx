import { GRID_SIZE, cellName, shipCells } from '../fleet.ts';
import type { Cell, Ship, Shot } from '../types.ts';

type GridProps = {
  label: string;                 // names the grid for screen readers, e.g. 'Your fleet'
  ships: Ship[];
  shots: Shot[];
  cells?: Cell[];                // squares marked as selected: the picked ship, a drop preview, a salvo's targets
  onCell?: (cell: Cell) => void; // absent: no square can be clicked
  dropTarget?: boolean;          // every square is a data-drop target for a dragged ship
};

const ROWS = 'ABCDEFGHIJ';
const INDEXES = Array.from({ length: GRID_SIZE }, (_, i) => i);

// The ship classes of one square: its run and, at either end, a rounded bow or stern
function shipClasses(ships: Ship[]): Map<string, string[]> {
  const classes = new Map<string, string[]>();
  for (const ship of ships) {
    const cells = shipCells(ship);
    cells.forEach((cell, i) => {
      const names = ['ship', `ship-${ship.orientation}`];
      if (i === 0) names.push('ship-bow');
      if (i === cells.length - 1) names.push('ship-stern');
      classes.set(cellName(cell), names);
    });
  }
  return classes;
}

// A 10x10 board with A to J down the side and 1 to 10 across the top; each square is a button named like B7
export default function Grid({ label, ships, shots, cells = [], onCell, dropTarget = false }: GridProps) {
  const onShip = shipClasses(ships);
  const shotAt = new Map(shots.map(shot => [cellName(shot), shot.result]));
  const selected = new Set(cells.map(cellName));

  return (
    <div className="naval-grid" role="group" aria-label={label}>
      <span className="grid-corner" />
      {INDEXES.map(col => <span key={col} className="grid-label">{col + 1}</span>)}
      {INDEXES.map(row => [
        <span key={`row-${row}`} className="grid-label">{ROWS[row]}</span>,
        ...INDEXES.map(col => {
          const name = cellName({ row, col });
          const result = shotAt.get(name);
          const classes = ['square', ...(onShip.get(name) ?? [])];
          if (result) classes.push(result === 'miss' ? 'miss' : 'hit', ...(result === 'sunk' ? ['sunk'] : []));
          if (selected.has(name)) classes.push('selected');
          return (
            <button
              key={name}
              type="button"
              className={classes.join(' ')}
              aria-label={name}
              aria-pressed={onCell && selected.has(name) ? true : undefined}
              data-drop={dropTarget ? `cell-${row}-${col}` : undefined}
              disabled={!onCell}
              onClick={() => onCell?.({ row, col })}
            />
          );
        })
      ])}
    </div>
  );
}
