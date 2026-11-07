import type { PublicGameState } from '../types.ts';

type Props = { gameState: PublicGameState; canSpin: boolean; onSpin: () => void };

// The spinner (1 to 10) or the teetotum (1 to 6): the last number spun, and the Spin button on the mover's turn
export default function Spinner({ gameState, canSpin, onSpin }: Props) {
  const { spin, lastMove, playerNames, board } = gameState;
  const spinner = board === 'checkered' ? 'Teetotum, 1 to 6' : 'Spinner, 1 to 10';
  const spun = lastMove?.spin === undefined ? '' : `${playerNames[lastMove.playerNumber]} spun ${lastMove.spin}`;
  return (
    <div className="spinner">
      <div className="spinner-face" aria-hidden="true">{spin ?? '?'}</div>
      <div className="spinner-text">
        <div className="spinner-name">{spinner}</div>
        <div className="spinner-result" aria-live="polite">{spun}</div>
      </div>
      <button type="button" className="primary" onClick={onSpin} disabled={!canSpin}>Spin</button>
    </div>
  );
}
