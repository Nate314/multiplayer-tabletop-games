import type { Drag } from '../../../src/drag/useDrag.ts';
import { squareKey } from './animateMove.ts';
import { includesPosition } from './selection.ts';
import { BOARD_SIZE, SEAT_COLORS, isDarkSquare, isSamePosition, pieceAt } from '../rules.ts';
import type { Position, PublicGameState, Seat } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { svgUrl } from '../../../src/assets/svgCache.ts';
import { DISC_URL } from '../../../src/components/pieces.ts';

const INDEXES = Array.from({ length: BOARD_SIZE }, (_, index) => index);

type BoardProps = {
  gameState: PublicGameState;
  // Seat 2 sees the board turned around, so their pieces start at the bottom
  flipped: boolean;
  dimmed: boolean;
  picked: Position[]; // the chosen piece, then the landing squares chosen so far
  movable: Position[]; // pieces that can start a move
  targets: Position[]; // squares that can be clicked next
  mustCapture: boolean;
  onSquareClick: (position: Position) => void;
  drag?: Drag; // the live board only; ids are "<row>-<col>"
};

function pieceLabel(seat: Seat, king: boolean): string {
  return `${SEAT_COLORS[seat]} ${king ? 'king' : 'man'}`;
}

export default function Board({ gameState, flipped, dimmed, picked, movable, targets, mustCapture, onSquareClick, drag }: BoardProps) {
  const { board, lastMove } = gameState;
  const toBoard = (index: number) => flipped ? BOARD_SIZE - 1 - index : index;

  function squareClassName(position: Position): string {
    const classNames = ['square', isDarkSquare(position) ? 'dark' : 'light'];
    if (includesPosition(targets, position)) classNames.push('target');
    if (includesPosition(picked.slice(1), position)) classNames.push('picked');
    if (lastMove && includesPosition(lastMove.path, position)) classNames.push('last-move');
    if (lastMove && includesPosition(lastMove.captured, position)) classNames.push('last-captured');
    return classNames.join(' ');
  }

  function pieceClassName(position: Position, seat: Seat, king: boolean): string {
    const classNames = ['piece', `player${seat}`];
    if (king) classNames.push('king');
    if (includesPosition(movable, position)) classNames.push(mustCapture ? 'must-capture' : 'movable');
    if (picked[0] && isSamePosition(picked[0], position)) classNames.push('selected');
    return classNames.join(' ');
  }

  return (
    <div className="board-frame">
      <div className={`board ${dimmed ? 'dimmed' : ''}`}>
        {INDEXES.map(screenRow => INDEXES.map(screenCol => {
          const position = { row: toBoard(screenRow), col: toBoard(screenCol) };
          const piece = pieceAt(board, position);
          const id = `${position.row}-${position.col}`;
          return (
            <div
              key={`${screenRow}-${screenCol}`}
              className={squareClassName(position)}
              data-anim-key={squareKey(position)}
              data-drop={id}
              onClick={() => onSquareClick(position)}
            >
              {piece && (
                <div className={pieceClassName(position, piece.seat, piece.king)} aria-label={pieceLabel(piece.seat, piece.king)} {...drag?.source(id)}>
                  <ServerSvg url={DISC_URL} className="piece-art" />
                  {piece.king && <ServerSvg url={svgUrl('checkers-crown')} className="crown" />}
                </div>
              )}
            </div>
          );
        }))}
      </div>
    </div>
  );
}
