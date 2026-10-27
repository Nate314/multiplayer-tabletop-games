import Blanks from './Blanks';
import Canvas from './Canvas';
import { ChatLines } from './Chat';
import Scores from './Scores';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The drawing at one step, read only, with the blanks (the word from the reveal on, or for a seat that knew it),
// who has guessed and the scores. The chat shows only with no seat picked (the table screen, History's Table only, or a plain spectator):
// a table screen and History hold just the public lines, a plain spectator gets the full chat
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="history-layout">
      <Blanks mask={gameState.mask} word={gameState.word} />
      <Canvas strokes={gameState.strokes} />
      <Scores gameState={gameState} playerNumber={viewer ?? 0} />
      {viewer === null && <ChatLines gameState={gameState} />}
    </div>
  );
}
