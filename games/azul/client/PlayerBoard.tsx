import Tile from './Tile';
import { FLOOR_PENALTIES, canPlaceOnLine, wallColor } from '../rules.ts';
import type { Color, PlayerBoard as Board } from '../types.ts';

type PlayerBoardProps = {
  board: Board;
  name: string;
  isMe: boolean;
  isCurrent: boolean;
  hasLeft: boolean;
  isWinner: boolean;
  // The colour picked up, on your own board on your turn; null everywhere else
  selectedColor: Color | null;
  onPlace: (line: number | 'floor') => void;
};

export default function PlayerBoard({ board, name, isMe, isCurrent, hasLeft, isWinner, selectedColor, onPlace }: PlayerBoardProps) {
  const classes = ['player-board', isMe ? 'board-mine' : 'board-other'];
  if (isCurrent) classes.push('board-current');
  if (hasLeft) classes.push('board-left');
  if (isWinner) classes.push('board-winner');

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
                className={legal ? 'pattern-line legal' : 'pattern-line'}
                disabled={!legal}
                aria-label={`Pattern line ${row + 1}`}
                onClick={() => onPlace(row)}
              >
                {Array.from({ length: row + 1 }, (_, slot) =>
                  line.color === null || slot < emptySlots
                    ? <span key={slot} className="slot" />
                    : <Tile key={slot} kind={line.color} />
                )}
              </button>
            );
          })}
        </div>
        <div className="wall">
          {board.wall.map((cells, row) =>
            cells.map((filled, col) => (
              <Tile key={`${row}-${col}`} kind={wallColor(row, col)} faded={!filled} />
            ))
          )}
        </div>
      </div>
      <button
        type="button"
        className={selectedColor !== null ? 'floor-line legal' : 'floor-line'}
        disabled={selectedColor === null}
        aria-label="Floor line"
        onClick={() => onPlace('floor')}
      >
        {FLOOR_PENALTIES.map((penalty, slot) => (
          <span key={slot} className="floor-slot">
            <span className="floor-penalty">-{penalty}</span>
            {board.floor[slot] ? <Tile kind={board.floor[slot]} /> : <span className="slot" />}
          </span>
        ))}
      </button>
    </section>
  );
}
