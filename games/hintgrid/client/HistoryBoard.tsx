import ClueLine from './ClueLine';
import Grid from './Grid';
import { TEAM_NAMES } from '../teams.ts';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The grid at one step, read only; the key shows as the viewer's seat may see it
export default function HistoryBoard({ gameState }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="history-layout hintgrid-layout">
      <div className="turn-message">{gameState.isGameOver ? gameState.gameStatus : `${TEAM_NAMES[gameState.turn]}'s turn`}</div>
      <ClueLine gameState={gameState} canEnd={false} />
      <Grid gameState={gameState} />
    </div>
  );
}
