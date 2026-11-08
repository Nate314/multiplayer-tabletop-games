import Blanks from '../../../src/components/guessing/Blanks';
import { ChatLines } from '../../../src/components/guessing/Chat';
import Scores from '../../../src/components/guessing/Scores';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// One step, read only: the blanks (the prompt from the reveal on, or for a seat that knew it), who has guessed and the scores.
// The chat shows only with no seat picked: a table screen and History hold just the public lines, a plain spectator gets the full chat
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="history-layout">
      <Blanks mask={gameState.mask} word={gameState.word} label="Prompt" className="charades-blanks" />
      <Scores gameState={gameState} playerNumber={viewer ?? 0} busyNote="acting" />
      {viewer === null && <ChatLines gameState={gameState} />}
    </div>
  );
}
