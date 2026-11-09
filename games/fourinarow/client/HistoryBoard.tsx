import Board from './Board';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The grid right after one move, with that disc and any winning four highlighted. Both seats see the same grid, so the viewer changes nothing. Nothing is clickable.
export default function HistoryBoard({ gameState }: { gameState: PublicGameState; viewer: Seat | null }) {
  return <Board gameState={gameState} dimmed={false} droppable={false} onDrop={() => {}} />;
}
