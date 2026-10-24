import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { SEAT_COLORS } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  error: string | null;
};

function turnMessage({ currentPlayer, playerNames, activePlayers, started, isGameOver }: PublicGameState, playerNumber: Seat): string {
  if (isGameOver) return 'Game Over';
  if (activePlayers.length < 2) return 'Waiting for an opponent';
  const name = currentPlayer === playerNumber ? 'You' : playerNames[currentPlayer as Seat];
  const verb = currentPlayer === playerNumber ? 'move' : 'moves';
  if (!started) return `${name} (${SEAT_COLORS[currentPlayer as Seat]}) ${verb} first. Joining closes after the first move.`;
  return currentPlayer === playerNumber ? 'Your turn' : `${name}'s turn`;
}

export default function GameStatus({ gameState, playerNumber, error }: GameStatusProps) {
  const { playerNames, currentPlayer, activePlayers, gameStatus } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
      <ul className="player-list">
        {seats.map(seat => (
          <li key={seat} className={`${seat === currentPlayer ? 'current' : ''} ${activePlayers.includes(seat) ? '' : 'player-left'}`}>
            <span className={`player-dot player${seat}`}><ColorSymbol color={SEAT_SYMBOLS[seat as Seat]} className="dot-symbol" /></span>
            {playerNames[seat]}{seat === playerNumber && ' (you)'}
            {!activePlayers.includes(seat) && ' (left)'}
            <span className="disc-color">{SEAT_COLORS[seat as Seat]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
