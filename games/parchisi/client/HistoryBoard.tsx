import Board from './Board';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The board right after one move, with that move highlighted. The seat is never on turn, so nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <Board
      gameState={gameState}
      playerNumber={viewer ?? 0}
      isMyTurn={false}
      selectedPawn={null}
      onSelectPawn={() => {}}
      onMove={() => {}}
    />
  );
}
