import YouTag from '../../../src/components/YouTag.tsx';
import PlayingCard from '../../../src/components/PlayingCard';
import { sameCard } from '../../../shared/playingCards.ts';
import { plural } from '../../../shared/text.ts';
import type { PublicGameState, Seat } from '../types.ts';

// The seats, the starter and the crib, and the cards played since the count last reset with their count
export default function PeggingArea({ gameState, viewer, showLastMove = false }: { gameState: PublicGameState; viewer: Seat | null; showLastMove?: boolean }) {
  const { activePlayers, playerNames, handCounts, dealer, currentPlayer, saidGo, starter, cribCount, pile, count, phase, lastMove, handNumber } = gameState;
  const lastPlayed = showLastMove && lastMove?.type === 'play' ? lastMove.card : null;
  return (
    <section className="table" aria-label="The table">
      <ol className="seats">
        {activePlayers.map(seat => (
          <li key={seat} className={seat === currentPlayer ? 'seat seat-current' : 'seat'}>
            <span className="seat-name">{playerNames[seat]}<YouTag when={seat === viewer} /></span>
            <span className="seat-count">{plural(handCounts[seat] ?? 0, 'card')}</span>
            {seat === dealer && <span className="seat-note">dealer</span>}
            {phase === 'pegging' && saidGo.includes(seat) && <span className="seat-note">Go</span>}
          </li>
        ))}
      </ol>
      <div className="table-middle">
        <div className="starter">
          <span className="table-label">Hand {handNumber}: starter</span>
          <PlayingCard card={starter} size="small" />
        </div>
        <div className="crib">
          <span className="table-label">{dealer === null ? 'Crib' : `${playerNames[dealer]}'s crib`}</span>
          <span>{plural(cribCount, 'card')}</span>
        </div>
      </div>
      {phase === 'pegging' && (
        <div className="pile" aria-label="Pegging">
          <div className="pile-cards">
            {pile.map(({ card }) => (
              <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="small" highlighted={lastPlayed !== null && sameCard(card, lastPlayed)} />
            ))}
          </div>
          <div className="pile-count">Count: {count}</div>
        </div>
      )}
    </section>
  );
}
