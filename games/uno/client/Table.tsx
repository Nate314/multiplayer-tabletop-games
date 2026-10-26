import Card from './Card';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { DISCARD_KEY } from './animateMove.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';
import { targetScore } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { svgUrl } from '../../../src/assets/svgCache.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog
  // Highlights who made the last move, who it hit, and the card it played; for the history dialog
  showLastMove?: boolean;
  // Given only when you may draw; the draw pile is then a button
  onDraw?: () => void;
};

// Every player's score and card count in seat order with the dealer and the direction of play, then the draw and discard piles
export default function Table({ gameState, viewer, showLastMove = false, onDraw }: TableProps) {
  const {
    handCounts, playerNames, currentPlayer, winners, direction, discardTop, currentColor, drawPileCount, lastMove,
    scores, dealer, roundNumber, unoWindow
  } = gameState;
  const pendingDraw = gameState.pendingDraw ?? null;
  const seats = Object.keys(handCounts).map(Number).sort((a, b) => a - b);
  const arrow = direction === 1 ? '→' : '←';
  const lastMover = showLastMove ? lastMove?.playerNumber : undefined;
  const lastTarget = showLastMove && lastMove?.type === 'play' ? lastMove.target : null;
  // A player who has not called UNO yet shows no badge until the window closes
  const uncalled = unoWindow && !unoWindow.called ? unoWindow.seat : null;

  return (
    <div className="table">
      <div className="round">Round {roundNumber}: first to {targetScore(gameState).toLocaleString('en-US')} points wins</div>
      <div className="direction">
        Direction: <span className="direction-arrow" aria-hidden="true">{arrow}</span> {direction === 1 ? 'in seat order' : 'reversed'}
      </div>
      <ol className="players">
        {seats.map(seat => {
          const count = handCounts[seat];
          const classes = ['player'];
          if (seat !== viewer) classes.push('hand-only-hide');
          if (seat === currentPlayer) classes.push('player-current');
          if (winners.includes(seat)) classes.push('player-winner');
          if (seat === lastMover) classes.push('player-last');
          if (seat === lastTarget) classes.push('player-target');
          return (
            <li key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)}>
              <span className="player-name">
                {playerNames[seat]}
                {seat === viewer && ' (you)'}
                {winners.includes(seat) && ' ★'}
              </span>
              <span className="player-count">{count} {count === 1 ? 'card' : 'cards'}</span>
              <span className="player-score">{scores[seat] ?? 0} pts{seat === dealer && ', dealer'}</span>
              {count === 1 && seat !== uncalled && <span className="uno-badge">UNO!</span>}
            </li>
          );
        })}
      </ol>
      {pendingDraw && (
        <div className="stack-count">
          Stack: {playerNames[pendingDraw.target]} draws {pendingDraw.count} unless they stack
        </div>
      )}
      <div className="piles">
        <div className="pile">
          {onDraw ? (
            <button type="button" className="card card-back card-playable" onClick={onDraw} aria-label="Draw a card">
              <ServerSvg url={svgUrl('uno-card', 'back')} className="piece-art" />
              <span className="card-face">UNO</span>
            </button>
          ) : (
            <span className="card card-back"><ServerSvg url={svgUrl('uno-card', 'back')} className="piece-art" /><span className="card-face">UNO</span></span>
          )}
          <span className="pile-label">Draw pile: {drawPileCount}</span>
        </div>
        <div className="pile">
          {discardTop
            ? <Card card={discardTop} animKey={DISCARD_KEY} highlighted={showLastMove && lastMove?.type === 'play'} />
            : <span className="card card-empty" />}
          <span className="pile-label">
            Color: <span className={`color-swatch swatch-${currentColor ?? 'any'}`}><ColorSymbol color={currentColor} className="swatch-symbol" /></span> <span className="color-name">{currentColor ?? 'any'}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
