import type { CSSProperties } from 'react';
import { COLS, DOORS, PASSAGES, ROOM_CELLS, ROWS, isCorridor } from '../board.ts';
import type { Cell, Position } from '../board.ts';
import { OBJECTS, ROOMS, SUSPECTS, nameOf } from '../content.ts';
import type { RoomId, SuspectId } from '../content.ts';
import type { PublicGameState } from '../types.ts';
import { tokenKey } from './animateMove.ts';

const DOOR_CELLS = new Set(DOORS.map(d => `${d.outside.row},${d.outside.col}`));
const CORRIDOR: Cell[] = Array.from({ length: ROWS * COLS }, (_, i) => ({ row: Math.floor(i / COLS), col: i % COLS })).filter(isCorridor);
const at = (p: Position, cell: Cell) => !('room' in p) && p.row === cell.row && p.col === cell.col;
const inRoom = (p: Position, room: RoomId) => 'room' in p && p.room === room;
// Grid lines are 1-based; every room is a rectangle of cells
function area(room: RoomId) {
  const cells = ROOM_CELLS[room];
  const rows = cells.map(c => c.row), cols = cells.map(c => c.col);
  return { gridRow: `${Math.min(...rows) + 1} / ${Math.max(...rows) + 2}`, gridColumn: `${Math.min(...cols) + 1} / ${Math.max(...cols) + 2}` };
}

function Token({ suspect }: { suspect: SuspectId }) {
  const { name, color } = SUSPECTS.find(s => s.id === suspect)!;
  return (
    <span className="wd-token" style={{ '--wd-token': `var(${color})` } as CSSProperties} role="img" aria-label={name} title={name}
      data-anim-key={tokenKey(suspect)}>
      {name.split(' ')[1][0]}
    </span>
  );
}

type BoardProps = {
  gameState: PublicGameState;
  onMove?: (to: Position) => void; // given only when the viewer may move now
  highlight?: Position | null; // the mover's square in the history dialog
};

// The hotel as page markup: rooms span their cells, corridor squares are buttons while they are a destination
export default function Board({ gameState, onMove, highlight }: BoardProps) {
  const { positions, objectRooms, destinations } = gameState;
  const targets = onMove ? destinations : [];
  const tokensAt = (where: (p: Position) => boolean) => SUSPECTS.filter(s => where(positions[s.id])).map(s => <Token key={s.id} suspect={s.id} />);
  const classes = (base: string, lit: boolean, target: boolean) => [base, lit && 'wd-highlight', target && 'wd-target'].filter(Boolean).join(' ');

  return (
    <div className="wd-board" style={{ gridTemplateRows: `repeat(${ROWS}, var(--wd-cell))`, gridTemplateColumns: `repeat(${COLS}, var(--wd-cell))` }}>
      {ROOMS.map(({ id, name }) => {
        const target = targets.some(p => inRoom(p, id));
        const passage = PASSAGES[id];
        const lit = !!highlight && inRoom(highlight, id);
        const inside = (
          <>
            <span className="wd-room-name">{name}</span>
            {passage && <span className="wd-passage">Passage to {nameOf(passage)}</span>}
            <span className="wd-chips">{OBJECTS.filter(o => objectRooms[o.id] === id).map(o => <span key={o.id} className="wd-chip">{o.name}</span>)}</span>
            <span className="wd-tokens">{tokensAt(p => inRoom(p, id))}</span>
          </>
        );
        return target
          ? <button key={id} type="button" className={classes('wd-room', lit, true)} style={area(id)} aria-label={`Move to ${name}`} onClick={() => onMove!({ room: id })}>{inside}</button>
          : <div key={id} className={classes('wd-room', lit, false)} style={area(id)}>{inside}</div>;
      })}
      {CORRIDOR.map(cell => {
        const style = { gridRow: cell.row + 1, gridColumn: cell.col + 1 };
        const base = DOOR_CELLS.has(`${cell.row},${cell.col}`) ? 'wd-square wd-door' : 'wd-square';
        const lit = !!highlight && at(highlight, cell);
        const tokens = tokensAt(p => at(p, cell));
        if (!targets.some(p => at(p, cell))) {
          return <div key={`${cell.row},${cell.col}`} className={classes(base, lit, false)} style={style}>{tokens}</div>;
        }
        return (
          <button key={`${cell.row},${cell.col}`} type="button" className={classes(base, lit, true)} style={style}
            aria-label={`Move to row ${cell.row + 1}, column ${cell.col + 1}`} onClick={() => onMove!(cell)}>
            {tokens}
          </button>
        );
      })}
    </div>
  );
}
