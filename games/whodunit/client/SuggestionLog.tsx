import { nameOf } from '../content.ts';
import type { PublicGameState, Seat } from '../types.ts';
import { trio } from './describeMove.ts';

// Every suggestion so far and how it went. seen holds only the viewer's own rows, so only those name the card
export default function SuggestionLog({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { suggestions, seen, playerNames } = gameState;
  const who = (seat: Seat) => (seat === viewer ? 'You' : playerNames[seat]);
  if (suggestions.length === 0) return null;
  return (
    <section className="wd-log" aria-label="Suggestions">
      <h3 className="wd-heading">Suggestions</h3>
      <ol>
        {suggestions.map((s, index) => {
          const card = seen.find(entry => entry.suggestion === index)?.card;
          const passed = s.passed.length > 0 ? `${s.passed.map(who).join(', ')} could not show. ` : '';
          const outcome = s.shownBy !== null ? `${who(s.shownBy)} showed a card${card ? `: ${nameOf(card)}` : ''}`
            : s.awaiting !== null ? `${who(s.awaiting)} is choosing a card` : 'Nobody could show a card';
          return <li key={index}>{who(s.by)} suggested {trio(s)}. {passed}{outcome}</li>;
        })}
      </ol>
    </section>
  );
}
