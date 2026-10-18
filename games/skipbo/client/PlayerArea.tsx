import CardView from './CardView';
import { handKey } from './animKeys.ts';
import { PILES } from '../rules.ts';
import type { Card, LastMove, PileIndex, PublicGameState, Seat, Source } from '../types.ts';

type PlayerAreaProps = {
  gameState: PublicGameState;
  seat: Seat;
  // Your own area on your turn: the stock top and discard tops can be picked, and a picked hand card discarded
  interactive?: boolean;
  picked?: Source | null;
  onPick?: (source: Source) => void;
  onDiscard?: (pile: PileIndex) => void;
  // The move to highlight, in the history dialog
  lastMove?: LastMove | null;
};

const samePick = (a: Source | null, b: Source) =>
  a !== null && a.kind === b.kind && (a.kind !== 'discard' || (b.kind === 'discard' && a.pile === b.pile));

// One player's stock (top card and count), hand size and four discard piles, fanned so every card shows
export default function PlayerArea({ gameState, seat, interactive = false, picked = null, onPick, onDiscard, lastMove = null }: PlayerAreaProps) {
  const { playerNames, stockTops, stockCounts, handCounts, discards, currentPlayer, winners } = gameState;
  const stockTop = stockTops[seat] ?? null;
  const piles = discards[seat] ?? [];
  const discarding = interactive && picked?.kind === 'hand';
  const mine = lastMove?.playerNumber === seat;
  const classes = ['seat'];
  if (currentPlayer === seat) classes.push('seat-current');
  if (winners.includes(seat)) classes.push('seat-winner');

  const pick = (source: Source) => onPick?.(source);
  const pickable = (source: Source, card: Card | null) =>
    interactive && card !== null ? { onClick: () => pick(source), selected: samePick(picked, source) } : {};

  return (
    <section className={classes.join(' ')} aria-label={`${playerNames[seat]}'s cards`}>
      <header className="seat-header">
        <span className="seat-name">{playerNames[seat]}</span>
        <span className="seat-counts" data-anim-key={handKey(seat)}>
          Hand {handCounts[seat] ?? 0} · Stock {stockCounts[seat] ?? 0}
        </span>
      </header>
      <div className="seat-cards">
        <div className={mine && lastMove?.type === 'play' && lastMove.from.kind === 'stock' ? 'stock pile-last' : 'stock'}>
          {stockTop
            ? <CardView card={stockTop} {...pickable({ kind: 'stock' }, stockTop)} />
            : <span className="card card-empty" aria-label="Stock empty" />}
          <span className="pile-label">Stock ({stockCounts[seat] ?? 0})</span>
        </div>
        <div className="discard-piles">
          {PILES.map(index => {
            const pile = piles[index] ?? [];
            const top = pile.at(-1) ?? null;
            const used = mine && ((lastMove?.type === 'discard' && lastMove.pile === index)
              || (lastMove?.type === 'play' && lastMove.from.kind === 'discard' && lastMove.from.pile === index));
            const fan = (
              <span className="fan">
                {pile.length === 0 && <span className="card card-small card-empty" aria-hidden="true" />}
                {pile.map((card, position) => position === pile.length - 1 && !discarding
                  ? <CardView key={card.id} card={card} small {...pickable({ kind: 'discard', pile: index }, top)} />
                  : <CardView key={card.id} card={card} small />)}
              </span>
            );
            const pileClass = used ? 'discard-pile pile-last' : 'discard-pile';
            if (discarding) {
              return (
                <button key={index} type="button" className={`${pileClass} pile-target`} onClick={() => onDiscard?.(index)} aria-label={`Discard on pile ${index + 1}`}>
                  {fan}
                </button>
              );
            }
            return <div key={index} className={pileClass} aria-label={`Discard pile ${index + 1}`}>{fan}</div>;
          })}
        </div>
      </div>
    </section>
  );
}
