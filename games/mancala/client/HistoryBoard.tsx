import Board from './Board';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The board right after one move, with that move highlighted. Seat 0 is nobody, so nothing is clickable.
export default function HistoryBoard({ gameState }: { gameState: PublicGameState; viewer: Seat | null }) {
  return <Board gameState={gameState} playerNumber={0} isMyTurn={false} onPlay={() => {}} />;
}
