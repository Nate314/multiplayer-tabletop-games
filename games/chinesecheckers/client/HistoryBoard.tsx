import Board from './Board';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The board right after one move, from the chosen seat's side (unturned when viewing the table only), with that move's line drawn. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return <Board gameState={gameState} viewer={viewer} dimmed={false} path={[]} movable={[]} targets={[]} onHoleClick={() => {}} />;
}
