import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import Dice from '../../../src/components/Dice';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import ScoreSheet from './ScoreSheet';
import animateMove, { DICE_KEY } from './animateMove.ts';
import { DICE_COUNT, ROLLS_PER_TURN, roundOf } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';

const makeMove = (move: Move) => gameService.makeMove(move);
const noHold = () => Array<boolean>(DICE_COUNT).fill(false);

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver, winners, sheets, dice, rollsLeft } = state;
  if (isGameOver) return `Game over: ${winners.map(seat => playerNames[seat]).join(' and ')} won`;
  if (activePlayers.length < 2) return 'Waiting for one more player';
  if (currentPlayer === null) return '';
  const mine = currentPlayer === playerNumber;
  const name = playerNames[currentPlayer];
  const round = `Round ${roundOf(sheets[currentPlayer])} of 13`;
  if (!started) return `${mine ? 'You roll' : `${name} rolls`} first. Joining closes after the first roll. ${round}`;
  if (!mine) return `${name}'s turn. ${round}`;
  if (dice.length === 0) return `Your turn: roll the dice. ${round}`;
  return rollsLeft > 0 ? `Your turn: hold dice and roll again, or score a box. ${round}` : `Your turn: score a box. ${round}`;
}

// Keyed by moveCount, so the hold choices start from what the server kept in the last roll after every move or undo
function Turn({ gameState, isMyTurn }: { gameState: PublicGameState; isMyTurn: boolean }) {
  const { dice, held, rollsLeft, currentPlayer, playerNames } = gameState;
  const [hold, setHold] = useState<boolean[]>(held.length === DICE_COUNT ? held : noHold());
  const rolled = dice.length > 0;
  const canHold = isMyTurn && rolled && rollsLeft > 0;

  return (
    <>
      {rolled && currentPlayer !== null && (
        <div data-anim-key={DICE_KEY}>
          <Dice
            values={dice}
            selected={hold}
            onToggle={canHold ? index => setHold(hold.map((flag, spot) => spot === index ? !flag : flag)) : undefined}
            label={`${playerNames[currentPlayer]}'s dice`}
            animKeyPrefix="die"
          />
        </div>
      )}
      <div className="yz-rolls">{rollsLeft} of {ROLLS_PER_TURN} rolls left</div>
      <button
        type="button"
        className="yz-button"
        disabled={!isMyTurn || rollsLeft === 0 || (rolled && hold.every(Boolean))}
        onClick={() => makeMove({ type: 'roll', hold: rolled ? hold : noHold() })}
      >
        {rolled ? 'Roll again' : 'Roll'}
      </button>
    </>
  );
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, playerNames, moveCount, dice } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const canScore = isMyTurn && dice.length > 0;
  const screenRef = useRef<HTMLDivElement>(null);
  useMoveAnimation(screenRef, gameState, animateMove);

  return (
    <>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          <div className="yz-turn">
            {!isGameOver && <Turn key={moveCount} gameState={gameState} isMyTurn={isMyTurn} />}
            <button type="button" className="yz-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <ScoreSheet gameState={gameState} viewer={playerNumber} onScore={canScore ? category => makeMove({ type: 'score', category }) : undefined} />
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
    </>
  );
}
