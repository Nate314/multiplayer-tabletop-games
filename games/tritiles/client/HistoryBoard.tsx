import Board from './Board';
import Hand from './Hand';
import Table from './Table';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one move, the tile just played outlined. Viewed as a player, their hand is shown below, read only
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { hand, playerNames, board, lastMove } = gameState;
  return (
    <>
      <Table gameState={gameState} viewer={viewer} showLastMove />
      <Board board={board} lastCell={lastMove?.type === 'play' ? lastMove.cell : null} />
      {viewer !== null && <Hand hand={hand} label={`${playerNames[viewer]}'s hand`} />}
    </>
  );
}
