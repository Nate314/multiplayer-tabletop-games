import RevealRows from './RevealRows';
import Scores from './Scores';
import VotingPanel from './VotingPanel';
import { namesOf } from './names.ts';
import type { PublicGameState, Seat } from '../types.ts';

// One step, read only: the word, the choices (bare texts until the reveal), who has written or voted, and the scores.
// It draws only what the view holds, so with no seat picked no author and no real definition shows before the reveal
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { phase, word, round, submission, written, playerNames } = gameState;
  return (
    <div className="history-layout fictionary-history">
      <div className="fictionary-word">{word}</div>
      <div className="fictionary-round">Round {round}</div>
      {phase === 'reveal' && <RevealRows gameState={gameState} viewer={viewer} />}
      {/* Seat 0 is never a player, so the choices show as a plain list with no buttons */}
      {phase === 'voting' && <VotingPanel gameState={gameState} playerNumber={0} />}
      {phase === 'writing' && (
        <div className="fictionary-panel">
          {viewer !== null && submission !== null && <div className="fictionary-own">{playerNames[viewer]} wrote: {submission}</div>}
          {written.length > 0 && <div className="fictionary-progress">Written: {namesOf(playerNames, written)}</div>}
        </div>
      )}
      <Scores gameState={gameState} viewer={viewer} />
    </div>
  );
}
