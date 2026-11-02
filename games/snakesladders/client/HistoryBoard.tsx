import Board from './Board';
import PlayerList from './PlayerList';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The board right after one roll, with that roll's squares outlined; nothing on it can be pressed
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="sl-history">
      <Board gameState={gameState} />
      <PlayerList gameState={gameState} playerNumber={viewer} />
    </div>
  );
}
