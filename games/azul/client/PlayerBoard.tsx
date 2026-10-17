import Tile from './Tile';
import { FLOOR_PENALTIES, canPlaceOnLine, wallColor } from '../rules.ts';
import { floorKey, lineKey, wallKey } from './animateMove.ts';
import type { Color, PlayerBoard as Board, Seat } from '../types.ts';

type PlayerBoardProps = {
  board: Board;
  seat: Seat;
  name: string;
  isMe: boolean;
  isCurrent: boolean;
  hasLeft: boolean;
  isWinner: boolean;
  // The color picked up, on your own board on your turn; null everywhere else
  selectedColor: Color | null;
  // The line the last move filled, highlighted in the history dialog; null everywhere else
  lastLine?: number | 'floor' | null;
  onPlace: (line: number | 'floor') => void;
};

export default function PlayerBoard({ board, seat, name, isMe, isCurrent, hasLeft, isWinner, selectedColor, lastLine = null, onPlace }: PlayerBoardProps) {
  const classes = ['player-board', isMe ? 'board-mine' : 'board-other'];
  if (isCurrent) classes.push('board-current');
  if (hasLeft) classes.push('board-left');
  if (isWinner) classes.push('board-winner');

  const lineClass = (base: string, legal: boolean, line: number | 'floor') =>
    [base, legal && 'legal', lastLine === line && 'last-line'].filter(Boolean).join(' ');

  return (
    <section className={classes.join(' ')}>
      <header className="board-header">
        <span className="board-name">
          {name}
          {isMe && ' (you)'}
          {hasLeft && ' (left)'}
          {isWinner && ' ★'}
        </span>
        <span className="board-score">{board.score} pts</span>
      </header>
      <div className="board-body">
        <div className="pattern-lines">
          {board.patternLines.map((line, row) => {
            const legal = selectedColor !== null && canPlaceOnLine(board, row, selectedColor);
            const emptySlots = row + 1 - line.count;
            return (
              <button
                key={row}
                type="button"
                className={lineClass('pattern-line', legal, row)}
                disabled={!legal}
                aria-label={`Pattern line ${row + 1}`}
                onClick={() => onPlace(row)}
              >
                {Array.from({ length: row + 1 }, (_, slot) =>
                  line.color === null || slot < emptySlots
                    ? <span key={slot} className="slot" data-anim-key={lineKey(seat, row, slot)} />
                    : <Tile key={slot} kind={line.color} animKey={lineKey(seat, row, slot)} />
                )}
              </button>
            );
          })}
        </div>
        <div className="wall">
          {board.wall.map((cells, row) =>
            cells.map((filled, col) => (
              <Tile key={`${row}-${col}`} kind={wallColor(row, col)} faded={!filled} animKey={wallKey(seat, row, col)} />
            ))
          )}
        </div>
      </div>
      <button
        type="button"
        className={lineClass('floor-line', selectedColor !== null, 'floor')}
        disabled={selectedColor === null}
        aria-label="Floor line"
        onClick={() => onPlace('floor')}
      >
        {FLOOR_PENALTIES.map((penalty, slot) => (
          <span key={slot} className="floor-slot">
            <span className="floor-penalty">-{penalty}</span>
            {board.floor[slot]
              ? <Tile kind={board.floor[slot]} animKey={floorKey(seat, slot)} />
              : <span className="slot" data-anim-key={floorKey(seat, slot)} />}
          </span>
        ))}
      </button>
    </section>
  );
}
