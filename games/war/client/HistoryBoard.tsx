import Table from './Table';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one flip, with the card it turned up highlighted. War has no hand: nobody sees the order
// of any pile, so every seat's view shows the same table, with the chosen player at the bottom. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return <Table gameState={gameState} viewer={viewer} showLastMove />;
}
