import YouTag from '../../../src/components/YouTag.tsx';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { HOME, PAWN_COUNT, inTurnOrder } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type PlayerListProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
};

export default function PlayerList({ gameState, playerNumber }: PlayerListProps) {
  const { playerNames, activePlayers, pawns, currentPlayer, winners } = gameState;
  const seats = inTurnOrder(Object.keys(playerNames).map(Number)); // listed in the order turns go

  return (
    <div className="player-list">
      <div className="panel-title">Players</div>
      {seats.map(seat => {
        const inGame = activePlayers.includes(seat);
        const classNames = ['player-row'];
        if (seat === playerNumber) classNames.push('player-you');
        if (seat === currentPlayer) classNames.push('player-current');
        if (!inGame) classNames.push('player-left');
        const home = pawns[seat]?.filter(progress => progress === HOME).length ?? 0;
        return (
          <div key={seat} className={classNames.join(' ')}>
            <span className={`player-dot player${seat}`}><ColorSymbol color={SEAT_SYMBOLS[seat]} className="dot-symbol" /></span>
            <span className="player-name">
              {playerNames[seat]}
              <YouTag when={seat === playerNumber} />
              {winners.includes(seat) && ' (winner)'}
            </span>
            <span className="player-home">{inGame ? `${home}/${PAWN_COUNT} home` : 'left'}</span>
          </div>
        );
      })}
    </div>
  );
}
