import Board from './Board';
import Scores from './Scores';
import Tile from './Tile';
import { rackKey } from './animateMove.ts';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The board right after one move, with the tiles of the last play highlighted, and the scores then.
// Viewed as a player, their rack is shown below in its own order, read only. Seat 0 is nobody and nothing takes clicks.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { board, lastMove, rack, playerNames } = gameState;
  const label = viewer === null ? '' : `${playerNames[viewer]}'s rack`;
  return (
    <div className="history-layout">
      <Board board={board} highlighted={lastMove?.type === 'play' ? lastMove.tiles : []} />
      <Scores gameState={gameState} playerNumber={viewer ?? 0} />
      {viewer !== null && (
        <section className="history-rack" aria-label={label}>
          <header className="history-rack-header">{label}</header>
          <div className="rack">
            {rack.map((letter, slot) => (
              <span key={slot} className="rack-slot"><Tile letter={letter} animKey={rackKey(slot)} /></span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
