import Table from './Table';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one move. Farkle hides nothing, so every viewer sees the same table and nothing is clickable.
export default function HistoryBoard({ gameState }: { gameState: PublicGameState; viewer: Seat | null }) {
  return <Table gameState={gameState} />;
}
