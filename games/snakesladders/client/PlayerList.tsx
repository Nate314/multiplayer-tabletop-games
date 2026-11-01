import YouTag from '../../../src/components/YouTag.tsx';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import type { PublicGameState, Seat } from '../types.ts';

type PlayerListProps = {
  gameState: PublicGameState;
  playerNumber: Seat | null;
};

// Seat order is turn order: seat 1 starts, then the seats in join order
export default function PlayerList({ gameState, playerNumber }: PlayerListProps) {
  const { playerNames, positions, currentPlayer, winners } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <div className="sl-player-list">
      <div className="sl-panel-title">Players</div>
      {seats.map(seat => {
        const square = positions[seat];
        const classNames = ['sl-player-row'];
        if (seat === playerNumber) classNames.push('sl-player-you');
        if (seat === currentPlayer) classNames.push('sl-player-current');
        if (square === undefined) classNames.push('sl-player-left');
        return (
          <div key={seat} className={classNames.join(' ')} aria-current={seat === currentPlayer ? 'true' : undefined}>
            <span className={`sl-player-dot sl-seat${seat}`}><ColorSymbol color={SEAT_SYMBOLS[seat]} className="sl-dot-symbol" /></span>
            <span className="sl-player-name">
              {playerNames[seat]}
              <YouTag when={seat === playerNumber} />
              {winners.includes(seat) && ' (winner)'}
            </span>
            <span className="sl-player-square">{square === undefined ? 'left' : `Square ${square}`}</span>
          </div>
        );
      })}
    </div>
  );
}
