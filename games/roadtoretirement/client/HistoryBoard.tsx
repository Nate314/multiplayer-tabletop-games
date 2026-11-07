import CheckeredBoard from './CheckeredBoard';
import PlayerList from './PlayerList';
import RoadBoard from './RoadBoard';
import type { PublicGameState, Seat } from '../types.ts';

// The board right after one move, with the mover's space or square outlined, and every player's standing.
// Nothing is hidden, so every seat sees the same; nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const mover = gameState.lastMove?.playerNumber;
  const space = mover === undefined ? null : gameState.road?.players[mover]?.space ?? null;
  const cell = mover === undefined ? null : gameState.checkered?.pieces[mover] ?? null;
  return (
    <div className="history-layout">
      <div className="board-area">
        {gameState.board === 'checkered'
          ? <CheckeredBoard gameState={gameState} canMove={false} onMove={() => {}} highlight={cell} />
          : <RoadBoard gameState={gameState} highlight={space} />}
      </div>
      <PlayerList gameState={gameState} viewer={viewer} />
    </div>
  );
}
