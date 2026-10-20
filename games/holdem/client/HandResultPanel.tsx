import type { ReactNode } from 'react';
import { chipText, uncalledPart } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

type HandResultPanelProps = {
  gameState: PublicGameState;
  children?: ReactNode; // Continue and the end vote, on the live screen
};

// How the last hand went: each pot and who took it, with the winning hand at a showdown.
// Once the game is over, every player ranked by chips.
export default function HandResultPanel({ gameState, children }: HandResultPanelProps) {
  const { handResult, playerNames, isGameOver, activePlayers, chips } = gameState;
  if (!handResult) return null;
  const names = (seats: number[]) => seats.map(seat => playerNames[seat]).join(' and ');
  const ranked = [...activePlayers].sort((a, b) => (chips[b] ?? 0) - (chips[a] ?? 0) || a - b);

  return (
    <section className="holdem-result" aria-label="Hand result">
      <h2>{isGameOver ? 'Final chips' : `Hand ${handResult.handNumber} result`}</h2>
      <ul className="holdem-result-pots">
        {handResult.pots.flatMap((pot, index) => {
          const { won, uncalled } = uncalledPart(pot, handResult.showdown);
          const title = index === 0 ? 'Pot' : `Side pot ${index}`;
          return [
            won > 0 && <li key={`${index}-won`}>{title} of {chipText(won)}: {names(pot.winners)}{pot.hand ? ` with ${pot.hand}` : ''}</li>,
            uncalled > 0 && <li key={`${index}-uncalled`}>{names(pot.winners)} gets back {chipText(uncalled)} uncalled</li>
          ].filter(Boolean);
        })}
      </ul>
      {isGameOver && (
        <ol className="holdem-standings">
          {ranked.map(seat => <li key={seat}>{playerNames[seat]}: {chipText(chips[seat] ?? 0)} chips</li>)}
        </ol>
      )}
      {children}
    </section>
  );
}
