import CardView from './CardView';
import type { DrawSource, PublicGameState } from '../types.ts';

type PilesProps = {
  gameState: PublicGameState;
  canDraw: boolean;
  onDraw: (source: DrawSource) => void;
  // The pile the last move used, in the history dialog; null on the live screen
  lastPile?: DrawSource | null;
};

// The face-down draw pile and the top of the discard pile. On your turn, click one to draw.
export default function Piles({ gameState, canDraw, onDraw, lastPile = null }: PilesProps) {
  const { drawCount, discardTop } = gameState;
  const canTakeDiscard = canDraw && discardTop !== null && discardTop.kind !== 'skip';
  const pileClass = (source: DrawSource) => (lastPile === source ? 'pile pile-last' : 'pile');

  return (
    <div className="piles">
      <button type="button" className={pileClass('pile')} disabled={!canDraw} onClick={() => onDraw('pile')}>
        <span className="card card-back" aria-hidden="true">10</span>
        <span className="pile-label">Draw pile ({drawCount})</span>
      </button>
      <button type="button" className={pileClass('discard')} disabled={!canTakeDiscard} onClick={() => onDraw('discard')}>
        {discardTop ? <CardView card={discardTop} /> : <span className="card card-empty" aria-hidden="true" />}
        <span className="pile-label">Discard</span>
      </button>
    </div>
  );
}
