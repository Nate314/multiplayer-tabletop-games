import YouTag from '../../../src/components/YouTag.tsx';
import { houseRule } from '../../../shared/houseRules.ts';
import { pointsText } from '../../../shared/standings.ts';
import { plural } from '../../../shared/text.ts';
import { TARGET_RULE } from '../options.ts';
import type { PublicGameState, Seat } from '../types.ts';

type OfferBoardProps = {
  gameState: PublicGameState;
  viewer: Seat | null;
  showLastMove?: boolean; // for the history dialog
  onAccept?: (offer: number) => void; // given only while the viewer may trade
};

// Every seat with its card count, score and open offer, which shows only its count
export default function OfferBoard({ gameState, viewer, showLastMove = false, onAccept }: OfferBoardProps) {
  const { activePlayers, playerNames, handCounts, scores, offers, winners, lastMove } = gameState;
  const myCount = offers.find(offer => offer.seat === viewer)?.count;
  let moved: Seat[] = [];
  if (showLastMove && lastMove) moved = lastMove.type === 'swap' ? lastMove.seats : [lastMove.playerNumber];

  return (
    <section className="tf-board" aria-label="Trading floor">
      <header className="tf-heading">First to {pointsText(houseRule(gameState, TARGET_RULE))} wins</header>
      <ol className="tf-seats">
        {activePlayers.map(seat => {
          const offer = offers.find(o => o.seat === seat);
          const classes = ['tf-seat'];
          if (moved.includes(seat)) classes.push('tf-seat-moved');
          if (winners.includes(seat)) classes.push('tf-seat-winner');
          return (
            <li key={seat} className={classes.join(' ')}>
              <span className="tf-seat-name">{playerNames[seat]}<YouTag when={seat === viewer} /></span>
              <span className="tf-seat-meta">{plural(handCounts[seat] ?? 0, 'card')}, {pointsText(scores[seat] ?? 0)}</span>
              {offer && (
                <span className="tf-bubble">
                  <span className="tf-bubble-text">{playerNames[seat]}: {offer.count}!</span>
                  {onAccept && seat !== viewer && (
                    <button type="button" className="tf-accept" aria-label={`Accept ${playerNames[seat]}'s offer of ${offer.count}`}
                      disabled={myCount !== offer.count} onClick={() => onAccept(offer.id)}>Accept</button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
