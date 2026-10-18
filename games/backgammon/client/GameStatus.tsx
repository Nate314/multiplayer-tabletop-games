import Dice from './Dice';
import { CHECKER_COLORS, CHECKERS_PER_PLAYER } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  isMyTurn: boolean;
  error: string | null;
};

function turnMessage({ currentPlayer, playerNames, activePlayers, started, isGameOver }: PublicGameState, playerNumber: Seat): string {
  if (isGameOver) return 'Game Over';
  if (activePlayers.length < 2) return 'Waiting for one more player';
  const currentName = currentPlayer == null ? '' : playerNames[currentPlayer];
  if (currentPlayer === playerNumber) return started ? 'Your turn' : 'You move first';
  return started ? `${currentName}'s turn` : `${currentName} moves first`;
}

function hint({ bar }: PublicGameState, playerNumber: Seat): string {
  return bar[playerNumber] > 0
    ? 'Enter from the bar first: click your checker on the bar, then a highlighted point'
    : 'Click a highlighted checker, then a highlighted point or your tray';
}

export default function GameStatus({ gameState, playerNumber, isMyTurn, error }: GameStatusProps) {
  const { playerNames, activePlayers, borneOff, dice, remaining, gameStatus, isGameOver } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className="bg-turn">{turnMessage(gameState, playerNumber)}</div>
      {dice.length > 0 && !isGameOver && <Dice dice={dice} remaining={remaining} />}
      {isMyTurn && <div className="bg-hint">{hint(gameState, playerNumber)}</div>}
      <ul className="bg-players">
        {seats.map(seat => (
          <li key={seat} className={activePlayers.includes(seat) ? '' : 'player-left'}>
            <span className={`bg-swatch ${CHECKER_COLORS[seat]}`} />
            <span className={seat === playerNumber ? 'bg-you' : ''}>
              {playerNames[seat]}{seat === playerNumber && ' (you)'}
            </span>
            <span className="bg-off">{borneOff[seat] ?? 0}/{CHECKERS_PER_PLAYER} off</span>
          </li>
        ))}
      </ul>
    </>
  );
}
