import YouTag from '../../../src/components/YouTag.tsx';
import Dice from './Dice';
import { CHECKER_COLORS, CHECKERS_PER_PLAYER, canDouble, canRoll, pointsText } from '../rules.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  isMyTurn: boolean;
  error: string | null;
  onMove: (move: Move) => void;
};

function turnMessage({ currentPlayer, playerNames, activePlayers, started, isGameOver, doubleOffer }: PublicGameState, playerNumber: Seat): string {
  if (isGameOver) return 'Game Over';
  if (activePlayers.length < 2) return 'Waiting for one more player';
  const currentName = currentPlayer == null ? '' : playerNames[currentPlayer];
  if (doubleOffer !== null) return currentPlayer === playerNumber ? 'Take or drop the double' : `${currentName} is deciding on your double`;
  if (currentPlayer === playerNumber) return started ? 'Your turn' : 'You move first';
  return started ? `${currentName}'s turn` : `${currentName} moves first`;
}

function hint(gameState: PublicGameState, playerNumber: Seat): string {
  const { bar, cube, doubleOffer } = gameState;
  if (doubleOffer !== null) return `Take to play on for ${pointsText(cube * 2)}, or drop to concede ${pointsText(cube)}`;
  if (canRoll(gameState)) return canDouble(gameState, playerNumber) ? 'Roll the dice, or offer to double first' : 'Roll the dice';
  return bar[playerNumber] > 0
    ? 'Enter from the bar first: click your checker on the bar, then a highlighted point'
    : 'Click a highlighted checker, then a highlighted point or your tray';
}

function cubeText({ cube, cubeOwner, playerNames, isGameOver, pointsWon, winners }: PublicGameState, playerNumber: Seat): string {
  if (isGameOver && pointsWon > 0) return `${playerNames[winners[0]]} won ${pointsText(pointsWon)}`;
  if (cubeOwner === null) return `Cube: ${cube}, in the middle`;
  return `Cube: ${cube}, ${cubeOwner === playerNumber ? 'yours' : `${playerNames[cubeOwner]}'s`}`;
}

// The buttons that start a turn, or answer a double
function TurnActions({ gameState, playerNumber, onMove }: Pick<GameStatusProps, 'gameState' | 'playerNumber' | 'onMove'>) {
  const button = (label: string, move: Move) => (
    <button key={label} type="button" className="bg-button" onClick={() => onMove(move)}>{label}</button>
  );
  if (gameState.doubleOffer !== null) {
    return <div className="bg-actions">{button('Take', { type: 'take' })}{button('Drop', { type: 'drop' })}</div>;
  }
  if (!canRoll(gameState)) return null;
  return (
    <div className="bg-actions">
      {button('Roll', { type: 'roll' })}
      {canDouble(gameState, playerNumber) && button(`Double to ${gameState.cube * 2}`, { type: 'double' })}
    </div>
  );
}

export default function GameStatus({ gameState, playerNumber, isMyTurn, error, onMove }: GameStatusProps) {
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
      {remaining.length > 0 && !isGameOver && <Dice dice={dice} remaining={remaining} />}
      {isMyTurn && <div className="bg-hint">{hint(gameState, playerNumber)}</div>}
      {isMyTurn && <TurnActions gameState={gameState} playerNumber={playerNumber} onMove={onMove} />}
      {activePlayers.length === 2 && <div className="bg-cube">{cubeText(gameState, playerNumber)}</div>}
      <ul className="bg-players">
        {seats.map(seat => (
          <li key={seat} className={activePlayers.includes(seat) ? '' : 'player-left'}>
            <span className={`bg-swatch ${CHECKER_COLORS[seat]}`} />
            <span className={seat === playerNumber ? 'bg-you' : ''}>
              {playerNames[seat]}<YouTag when={seat === playerNumber} />
            </span>
            <span className="bg-off">{borneOff[seat] ?? 0}/{CHECKERS_PER_PLAYER} off</span>
          </li>
        ))}
      </ul>
    </>
  );
}
