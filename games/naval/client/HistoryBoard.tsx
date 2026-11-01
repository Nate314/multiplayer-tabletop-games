import Grid from './Grid';
import { shipsOf, shotsAt } from './sea.ts';
import type { PublicGameState, Seat } from '../types.ts';

// Both grids after one move, the viewer's own first with their fleet; another fleet shows only once the game is over
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const seats: Seat[] = viewer === 2 ? [2, 1] : [1, 2];
  const lastShots = gameState.lastMove?.shots ?? [];
  return (
    <div className="naval-seas history-board">
      {seats.map(seat => (
        <section key={seat} className="sea">
          <h3 className="sea-title">{gameState.playerNames[seat]}</h3>
          <Grid
            label={gameState.playerNames[seat] ?? ''}
            ships={shipsOf(gameState, seat, viewer)}
            shots={shotsAt(gameState, seat)}
            cells={gameState.lastMove && gameState.lastMove.playerNumber !== seat ? lastShots : []}
          />
        </section>
      ))}
    </div>
  );
}
