import Board from './Board';
import type { PublicGameState } from '../types.ts';

// The board right after one move, from Red's side, with that move highlighted. Nothing is clickable.
export default function HistoryBoard({ gameState }: { gameState: PublicGameState }) {
  return (
    <Board
      gameState={gameState}
      flipped={false}
      dimmed={false}
      picked={[]}
      movable={[]}
      targets={[]}
      mustCapture={false}
      onSquareClick={() => {}}
    />
  );
}
