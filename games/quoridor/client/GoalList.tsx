import YouTag from '../../../src/components/YouTag.tsx';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { SEATS } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type GoalListProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
};

export default function GoalList({ gameState, playerNumber }: GoalListProps) {
  const { playerNames, activePlayers } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <div className="goal-list">
      <div className="panel-title">Goals</div>
      {seats.map(seat => {
        const classNames = ['goal-list-row'];
        if (seat === playerNumber) classNames.push('goal-list-you');
        if (!activePlayers.includes(seat)) classNames.push('player-left');
        return (
          <div key={seat} className={classNames.join(' ')}>
            <span className={`goal-dot player${seat}`}><ColorSymbol color={SEAT_SYMBOLS[seat]} className="dot-symbol" /></span>
            {playerNames[seat]}
            <YouTag when={seat === playerNumber} /> → {SEATS[seat].goalLabel}
          </div>
        );
      })}
    </div>
  );
}
