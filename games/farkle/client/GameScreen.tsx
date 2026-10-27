import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import Table from './Table';
import { score } from '../scoring.ts';
import { targetScore } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState, Seat } from '../types.ts';

function turnMessage(state: PublicGameState, playerNumber: Seat, picked: number | null): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver, winners, dice, finalTurns } = state;
  if (isGameOver) return winners.length > 0 ? `Game over: ${winners.map(seat => playerNames[seat]).join(' and ')} won` : 'Game over';
  if (activePlayers.length < 2) return 'Waiting for one more player';
  const mine = currentPlayer === playerNumber;
  const name = currentPlayer === null ? '' : playerNames[currentPlayer];
  if (!started) return `${mine ? 'You roll' : `${name} rolls`} first. Joining closes after the first roll.`;
  if (!mine) return `${name}'s turn`;
  const last = finalTurns.includes(playerNumber) ? ` This is your last turn: someone reached ${targetScore(state).toLocaleString()}.` : '';
  if (dice.length === 0) return `Your turn: roll the dice.${last}`;
  if (picked === null) return `Your turn: click the scoring dice to set aside. Dice that do not score cannot be set aside.${last}`;
  return `Your turn: ${picked.toLocaleString()} points selected.${last}`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, moveCount, dice, turnTotal } = gameState;
  const [picked, setPicked] = useState<boolean[]>([]);
  const screenRef = useRef<HTMLDivElement>(null);
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  useMoveAnimation(screenRef, gameState, animateMove);

  // Every new state (a roll, a bank, an undo) starts with nothing picked
  useEffect(() => setPicked([]), [moveCount]);

  const keep = dice.flatMap((_, index) => picked[index] ? [index] : []);
  const points = keep.length > 0 ? score(keep.map(index => dice[index])) : null;
  const toggle = (index: number) => setPicked(current => dice.map((_, die) => die === index ? !current[die] : Boolean(current[die])));
  const roll = () => gameService.makeMove({ type: 'roll', keep });
  const bank = () => gameService.makeMove({ type: 'bank', keep });
  const rolling = dice.length === 0;
  const hot = keep.length === dice.length && keep.length > 0;

  return (
    <>
      <div className="game-id hand-only-hide">Game ID: {gameState.gameId}</div>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">You are {gameState.playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turnMessage(gameState, playerNumber, isMyTurn && !rolling ? points : null)}</div>
          {isMyTurn && !rolling && keep.length > 0 && (
            <div className="farkle-selection">
              {points === null
                ? 'Every die you set aside must score'
                : `Banking now gives ${(turnTotal + points).toLocaleString()} points`}
            </div>
          )}
          <div className="action-buttons">
            <button type="button" onClick={roll} disabled={!isMyTurn || (!rolling && points === null)}>
              {rolling ? 'Roll' : hot ? 'Roll six new dice' : 'Roll again'}
            </button>
            <button type="button" onClick={bank} disabled={!isMyTurn || rolling || points === null}>Bank</button>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <Table gameState={gameState} selected={picked} onToggle={isMyTurn && !rolling ? toggle : undefined} viewer={playerNumber} />
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
