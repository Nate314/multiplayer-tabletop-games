import YouTag from '../../../src/components/YouTag.tsx';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { MARBLE_COUNT, SEAT_COLORS, marblesHome } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  isMyTurn: boolean;
  error: string | null;
};

function turnMessage({ currentPlayer, playerNames, activePlayers, started, isGameOver }: PublicGameState, isMyTurn: boolean): string {
  if (isGameOver) return 'Game Over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  const turn = isMyTurn ? 'Your turn' : `${currentPlayer === null ? '' : playerNames[currentPlayer]}'s turn`;
  return started ? turn : `${turn}. Joining closes after the first move.`;
}

export default function GameStatus({ gameState, playerNumber, isMyTurn, error }: GameStatusProps) {
  const { playerNames, activePlayers, currentPlayer, winners, gameStatus } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b); // seat order is turn order

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className={isMyTurn ? 'turn-message your-turn' : 'turn-message'}>{turnMessage(gameState, isMyTurn)}</div>
      <ul className="player-list">
        {seats.map(seat => {
          const inGame = activePlayers.includes(seat);
          const classNames = [seat === currentPlayer ? 'current' : '', inGame ? '' : 'player-left'];
          return (
            <li key={seat} className={classNames.join(' ').trim()}>
              <span className={`player-dot player${seat}`} title={SEAT_COLORS[seat]}>
                <ColorSymbol color={SEAT_SYMBOLS[seat]} className="dot-symbol" />
              </span>
              <span className="player-name">
                {playerNames[seat]}<YouTag when={seat === playerNumber} />
                {winners.includes(seat) && ' (winner)'}
              </span>
              <span className="player-home">{inGame ? `${marblesHome(gameState, seat)} of ${MARBLE_COUNT} home` : 'left'}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
