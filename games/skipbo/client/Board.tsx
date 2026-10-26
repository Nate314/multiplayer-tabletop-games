import CardView from './CardView';
import { PILES, nextValue } from '../rules.ts';
import type { Card, PileIndex, PublicGameState } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { cardArtUrl } from '../../../src/components/pieces.ts';

type BoardProps = {
  gameState: PublicGameState;
  // The card picked to play, so the piles it fits can be clicked; null when nothing is picked
  picked: Card | null;
  onPlay: (to: PileIndex) => void;
  // The pile the last move built on, in the history dialog
  lastPile?: PileIndex | null;
};

// The face-down draw pile and the four shared building piles
export default function Board({ gameState, picked, onPlay, lastPile = null }: BoardProps) {
  const { drawCount, building } = gameState;
  return (
    <section className="board hand-only-board" aria-label="Building piles">
      <div className="pile draw-pile">
        <span className="card card-back" aria-hidden="true"><ServerSvg url={cardArtUrl('stripes')} className="piece-art" />Skip-Bo</span>
        <span className="pile-label">Draw pile ({drawCount})</span>
      </div>
      {PILES.map(index => {
        const pile = building[index];
        const top = pile.at(-1);
        const needs = nextValue(pile);
        const canPlay = picked !== null && (picked.kind === 'skipbo' || picked.value === needs);
        const classes = ['pile', 'building-pile'];
        if (canPlay) classes.push('pile-target');
        if (lastPile === index) classes.push('pile-last');
        const label = `Building pile ${index + 1}, ${pile.length === 0 ? 'empty' : `up to ${pile.length}`}`;
        return (
          <button
            key={index}
            type="button"
            className={classes.join(' ')}
            disabled={!canPlay}
            onClick={() => onPlay(index)}
            aria-label={canPlay ? `Play on ${label}` : label}
            data-anim-key={`build-${index}`}
          >
            {top ? <CardView card={top} standsFor={top.kind === 'skipbo' ? pile.length : null} /> : <span className="card card-empty">1</span>}
            <span className="pile-label">{pile.length === 0 ? 'Start with 1' : `Needs ${needs}`}</span>
          </button>
        );
      })}
    </section>
  );
}
