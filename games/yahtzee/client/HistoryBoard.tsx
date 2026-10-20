import Dice from '../../../src/components/Dice';
import ScoreSheet from './ScoreSheet';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one move: the dice that were rolled or scored, and every sheet with the scored box outlined.
// Nothing is hidden, so every seat sees the same table; the chosen seat is only marked "(you)". Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { lastMove, held, playerNames } = gameState;
  return (
    <div className="yz-table">
      {lastMove && (
        <Dice values={lastMove.dice} selected={lastMove.type === 'roll' ? held : []} label={`${playerNames[lastMove.playerNumber]}'s dice`} />
      )}
      <ScoreSheet gameState={gameState} viewer={viewer} showLastMove />
    </div>
  );
}
