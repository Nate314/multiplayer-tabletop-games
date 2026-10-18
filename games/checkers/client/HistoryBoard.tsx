import Board from './Board';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The board right after one move, from the chosen seat's side (Red's when viewing the table only), with that move highlighted. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <Board
      gameState={gameState}
      flipped={viewer === 2}
      dimmed={false}
      picked={[]}
      movable={[]}
      targets={[]}
      mustCapture={false}
      onSquareClick={() => {}}
    />
  );
}
