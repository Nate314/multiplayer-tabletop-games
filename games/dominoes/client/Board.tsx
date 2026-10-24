import type { CSSProperties } from 'react';
import Tile from './Tile';
import { lineKey } from './animateMove.ts';
import { boardRows } from './boardRows.ts';
import type { Cell, Row } from './boardRows.ts';
import { endLabel } from '../board.ts';
import type { Board as BoardModel } from '../board.ts';
import type { Seat } from '../types.ts';

type BoardProps = {
  board: BoardModel;
  playerNames: Record<Seat, string>;
  openTrains: Seat[];
  lastTile: number | null;
  usable?: number[]; // ends to highlight as yours to use
  fits?: number[]; // ends the held or selected tile fits: buttons
  onEnd?: (arm: number) => void;
  startDrop?: boolean; // the empty board is a drop target for the first tile
};

// The board in rows: the hub row (the line through the starter) in the middle, the arms above and below it, and each
// double's branches in rows of their own. The hub row keeps the line's class and name.
export default function Board({ board, playerNames, openTrains, lastTile, usable = [], fits = [], onEnd, startDrop = false }: BoardProps) {
  const rows = boardRows(board, playerNames, openTrains);

  function cell(item: Cell) {
    if (item.kind === 'tile') {
      return (
        <span key={item.tile} role="listitem" className="line-slot">
          <Tile pips={item.pips} animKey={lineKey(item.tile)} highlighted={item.tile === lastTile} />
        </span>
      );
    }
    const name = `Open end: ${endLabel(board, item.arm, playerNames)} (${item.pips})`;
    const classes = ['end-slot'];
    if (usable.includes(item.arm)) classes.push('end-slot-usable');
    const drop = `end-${item.arm}`;
    if (fits.includes(item.arm)) {
      classes.push('end-slot-fits');
      return (
        <span key={drop} role="listitem" className="line-slot">
          <button type="button" className={classes.join(' ')} aria-label={name} data-drop={drop} onClick={() => onEnd?.(item.arm)}>
            {item.pips}
          </button>
        </span>
      );
    }
    return (
      <span key={drop} role="listitem" className="line-slot">
        <span className={classes.join(' ')} title={name} data-drop={drop}>{item.pips}</span>
      </span>
    );
  }

  function row({ key, label, place, depth, open, cells }: Row) {
    const classes = ['board-row', `board-row-${place}`];
    if (open) classes.push('board-row-open');
    if (place === 'hub') classes.push('line');
    const name = label === null ? 'Line of play' : `${label}${open ? ' (open)' : ''}`;
    return (
      <div key={key} className={classes.join(' ')} role="list" aria-label={name} style={{ '--depth': depth } as CSSProperties}>
        {label !== null && <span className="board-row-label" aria-hidden="true">{name}</span>}
        {cells.map(cell)}
      </div>
    );
  }

  return (
    <div className="board">
      {rows.length > 0 ? rows.map(row) : (
        <div className="board-row board-row-hub line" role="list" aria-label="Line of play">
          {startDrop && <span role="listitem" className="line-slot"><span className="end-slot board-start" data-drop="start" /></span>}
        </div>
      )}
    </div>
  );
}
