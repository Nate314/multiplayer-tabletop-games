import PieceGlyph from './PieceGlyph';
import { useCountdown, formatClock } from '../../../src/hooks/useCountdown.ts';
import useTimerWarning from '../../../src/sound/useTimerWarning.ts';
import { colorOf, deadline, isInCheck, opponent } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  error: string | null;
};

const SEATS: Seat[] = [1, 2];

function turnMessage({ currentPlayer, playerNames, activePlayers, started, isGameOver, board }: PublicGameState): string {
  if (isGameOver) return 'Game Over';
  if (activePlayers.length < 2 || currentPlayer == null) return 'Waiting for an opponent';
  const name = playerNames[currentPlayer];
  if (!started) return `${name} plays white and moves first. Joining closes after the first move.`;
  const check = isInCheck(board, colorOf(currentPlayer)) ? ' (in check)' : '';
  return `${name}'s turn${check}`;
}

function capitalized(text: string): string {
  return text[0].toUpperCase() + text.slice(1);
}

export default function GameStatus({ gameState, playerNumber, error }: GameStatusProps) {
  const { gameStatus, playerNames, activePlayers, captured, currentPlayer, isGameOver, clock } = gameState;
  const limit = deadline(gameState);
  const timeLeft = useCountdown(limit, gameState.serverTime); // the running player's time; others show what they had
  useTimerWarning(timeLeft, currentPlayer === playerNumber && !isGameOver);

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div>{turnMessage(gameState)}</div>
      <ul className="player-list">
        {SEATS.filter(seat => playerNames[seat]).map(seat => {
          const color = colorOf(seat);
          const taken = captured[opponent(color)];
          const classNames = ['player-row'];
          const running = timeLeft !== null && seat === currentPlayer;
          if (seat === currentPlayer && !isGameOver) classNames.push('to-move');
          if (!activePlayers.includes(seat)) classNames.push('player-left');
          return (
            <li key={seat} className={classNames.join(' ')}>
              <div className="player-name">
                <PieceGlyph color={color} type="king" />
                {playerNames[seat]} ({capitalized(color)}){seat === playerNumber && ' (you)'}
                {!activePlayers.includes(seat) && ' (left)'}
                {clock && (
                  <span className={running ? 'chess-clock chess-clock-running' : 'chess-clock'} aria-label={`${playerNames[seat]}'s time`}>
                    {formatClock(running ? timeLeft : clock.remainingMs[seat])}
                  </span>
                )}
              </div>
              <div className="captured" aria-label={`Pieces ${playerNames[seat]} captured`}>
                {taken.length === 0
                  ? <span className="captured-none">No captures</span>
                  : taken.map((type, index) => <PieceGlyph key={index} color={opponent(color)} type={type} />)}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
