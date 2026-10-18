import Board from './Board';
import PlayerList from './PlayerList';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The board right after one move, with the space the mover ended on outlined, and every player's holdings.
// Nothing is hidden in Monopoly but the deck order, so every seat sees the same; nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const mover = gameState.lastMove?.playerNumber;
  const highlight = mover === undefined ? null : gameState.positions[mover] ?? null;
  return (
    <div className="history-layout">
      <Board gameState={gameState} highlight={highlight} />
      <PlayerList gameState={gameState} viewer={viewer} />
    </div>
  );
}
