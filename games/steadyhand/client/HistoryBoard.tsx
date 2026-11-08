import { houseRule } from '../../../shared/houseRules.ts';
import { TOLERANCE, TOLERANCE_RULE } from '../options.ts';
import Bay from './Bay';
import type { PublicGameState, Seat } from '../types.ts';
import type { HistoryStep } from '../../../shared/types.ts';

// The bay for every watcher: History, spectators and the table screen. A spectator or table screen sees the live part
// move; History's start step is the first move's before snapshot and may still hold the last streamed position, so it
// draws every part at rest (later steps never hold one)
export default function HistoryBoard({ gameState }: { gameState: PublicGameState & { historyStep?: HistoryStep['historyStep'] }; viewer: Seat | null }) {
  const { lastMove, live } = gameState;
  const held = gameState.historyStep !== 'start' && live ? { part: live.part, at: live.at, watched: true } : null;
  return (
    <div className="sh-history">
      <Bay gameState={gameState} factor={TOLERANCE[houseRule(gameState, TOLERANCE_RULE)]} held={held}
        highlight={lastMove?.part ?? null} buzzAt={lastMove?.type === 'buzz' ? lastMove.at : null} />
    </div>
  );
}
