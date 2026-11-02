import YouTag from '../../../src/components/YouTag.tsx';
import { colorOf } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

const SEATS: Seat[] = [1, 2];

const capitalized = (text: string) => text[0].toUpperCase() + text.slice(1);

// Each player's color, name and captures, then the live count while marking or the final count after it
export default function ScorePanel({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, activePlayers, captures, currentPlayer, isGameOver, projected, score } = gameState;
  const count = score ?? projected;

  return (
    <>
      <ul className="player-list">
        {SEATS.filter(seat => playerNames[seat]).map(seat => {
          const color = colorOf(seat);
          const classNames = ['player-row'];
          if (seat === currentPlayer && !isGameOver) classNames.push('to-move');
          if (!activePlayers.includes(seat)) classNames.push('player-left');
          return (
            <li key={seat} className={classNames.join(' ')}>
              <div className="player-name">
                <span className={`go-swatch ${color}`} aria-hidden="true" />
                {playerNames[seat]} ({capitalized(color)})<YouTag when={seat === viewer} />
                {!activePlayers.includes(seat) && ' (left)'}
              </div>
              <div className="go-captures">Captures: {captures[color]}</div>
            </li>
          );
        })}
      </ul>
      {count && (
        <table className="go-count">
          <caption>{score ? 'Final count' : 'Projected count'}</caption>
          <thead>
            <tr><td></td><th scope="col">Black</th><th scope="col">White</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Stones</th><td>{count.black.stones}</td><td>{count.white.stones}</td></tr>
            <tr><th scope="row">Territory</th><td>{count.black.territory}</td><td>{count.white.territory}</td></tr>
            <tr><th scope="row">Komi</th><td>0</td><td>{count.white.komi}</td></tr>
            <tr className="go-total"><th scope="row">Total</th><td>{count.black.total}</td><td>{count.white.total}</td></tr>
          </tbody>
        </table>
      )}
    </>
  );
}
