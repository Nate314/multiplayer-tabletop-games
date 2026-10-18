import Table from './Table';
import type { PublicGameState } from '../types.ts';

// The table right after one move: every card count, the top discard and the color, with the player who moved,
// whoever their card hit and the card played highlighted. Nobody's hand is shown and nothing is clickable.
export default function HistoryBoard({ gameState }: { gameState: PublicGameState }) {
  return <Table gameState={gameState} viewer={null} showLastMove />;
}
