import { nameOf } from '../content.ts';
import type { CardId } from '../content.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';
import { Card } from './Hand';

// Shown only to the holder the game waits on: they pick which of their matching cards the suggester sees
export default function ShowPrompt({ gameState, viewer, onMove }: { gameState: PublicGameState; viewer: Seat; onMove: (move: Move) => void }) {
  const suggestion = gameState.suggestions.at(-1);
  if (gameState.phase !== 'showing' || !suggestion || suggestion.awaiting !== viewer) return null;
  const asked: CardId[] = [suggestion.suspect, suggestion.object, suggestion.room];
  const matches = gameState.hand.filter(card => asked.includes(card));
  return (
    <section className="wd-show" aria-label="Show a card">
      <h3 className="wd-heading">Show {gameState.playerNames[suggestion.by]} one card</h3>
      <div className="wd-hand-cards">
        {matches.map(card => (
          <button key={card} type="button" className="wd-card-button" aria-label={`Show ${nameOf(card)}`} onClick={() => onMove({ type: 'show', card })}>
            <Card card={card} />
          </button>
        ))}
      </div>
    </section>
  );
}
