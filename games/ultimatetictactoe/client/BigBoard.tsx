import Grid from '../../tictactoe/client/Grid';
import Mark from '../../tictactoe/client/Mark';
import { CELL_NAMES } from '../../tictactoe/lines.ts';
import { markOf } from '../../tictactoe/marks.ts';
import { boardResults, playableBoards } from '../rules.ts';
import { cellPrefix } from './animateMove.ts';
import type { PublicGameState } from '../types.ts';

type BigBoardProps = {
  gameState: PublicGameState;
  playable: boolean; // whether this player may mark now
  onPlace: (board: number, cell: number) => void;
};

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// The nine small boards in a 3x3. The boards in play are highlighted while the game runs; claimed boards show their owner's big mark.
export default function BigBoard({ gameState, playable, onPlace }: BigBoardProps) {
  const { boards, xSeat, lastMove, winningLine, isGameOver } = gameState;
  const results = boardResults(gameState);
  const open = isGameOver ? [] : playableBoards(gameState);

  return (
    <div className="big-board">
      {boards.map((cells, board) => {
        const result = results[board];
        const name = capitalized(CELL_NAMES[board]);
        const owner = result === null || result === 'draw' ? null : markOf({ xSeat }, result);
        const classNames = ['small-board'];
        if (open.includes(board)) classNames.push('playable');
        if (owner) classNames.push('claimed', `claimed-${owner.toLowerCase()}`);
        if (result === 'draw') classNames.push('drawn');
        if (winningLine?.includes(board)) classNames.push('winning');
        return (
          <div key={board} className={classNames.join(' ')} data-board={board} role="group" aria-label={`${name} board`}>
            <Grid
              cells={cells}
              xSeat={xSeat}
              playable={cell => playable && open.includes(board) && cells[cell] === null}
              onPlace={cell => onPlace(board, cell)}
              lastCell={lastMove?.board === board ? lastMove.cell : null}
              winningLine={null}
              keyPrefix={cellPrefix(board)}
              label={name}
            />
            {owner && <div className="claimed-mark"><Mark mark={owner} /></div>}
          </div>
        );
      })}
    </div>
  );
}
