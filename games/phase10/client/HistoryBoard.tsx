import Piles from './Piles';
import Table from './Table';
import type { DrawSource, PublicGameState } from '../types.ts';

// The piles and every player's laid-down groups right after one move, with the pile or groups it used highlighted.
// No hand is shown and nothing is clickable.
export default function HistoryBoard({ gameState }: { gameState: PublicGameState }) {
  const { lastMove, phases } = gameState;
  let lastPile: DrawSource | null = null;
  if (lastMove?.type === 'draw') lastPile = lastMove.source;
  if (lastMove?.type === 'discard') lastPile = 'discard';

  return (
    <>
      <Piles gameState={gameState} canDraw={false} onDraw={() => {}} lastPile={lastPile} />
      <Table
        gameState={gameState}
        seats={Object.keys(phases).map(Number)}
        playerNumber={null}
        canHit={false}
        onHit={() => {}}
        lastMove={lastMove}
      />
    </>
  );
}
