import { houseRule } from '../../../shared/houseRules.ts';
import { TOLERANCE, TOLERANCE_RULE } from '../options.ts';
import Bay from './Bay';
import type { PublicGameState, Seat } from '../types.ts';

// The bay after one move, the same for every viewer. `live` is ignored: the start step is the first move's before
// snapshot and may still hold the last streamed position, so every part is drawn at rest or in the tray
export default function HistoryBoard({ gameState }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { lastMove } = gameState;
  return (
    <div className="sh-history">
      <Bay gameState={gameState} factor={TOLERANCE[houseRule(gameState, TOLERANCE_RULE)]} held={null}
        highlight={lastMove?.part ?? null} buzzAt={lastMove?.type === 'buzz' ? lastMove.at : null} />
    </div>
  );
}
