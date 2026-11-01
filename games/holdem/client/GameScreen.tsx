import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import HandResultPanel from './HandResultPanel';
import Table from './Table';
import { chipText, options } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState, Seat } from '../types.ts';

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver, winners, handResult, chips, dealtIn } = state;
  if (isGameOver) return winners.length === 0 ? 'Game over' : `Game over: ${winners.map(seat => playerNames[seat]).join(' and ')} ${winners.length === 1 ? 'wins' : 'tie'}`;
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  if (handResult) return `Hand ${handResult.handNumber} is over`;
  if (!dealtIn.includes(playerNumber) && (chips[playerNumber] ?? 0) === 0) return 'You are out of chips and watching';
  const mine = currentPlayer === playerNumber;
  const name = mine ? 'You' : currentPlayer === null ? '' : playerNames[currentPlayer];
  if (!started) return `${name} ${mine ? 'act' : 'acts'} first. Joining closes after the first move.`;
  return mine ? 'Your turn' : `${name}'s turn`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, handResult,
    chips, currentBet, endVotes, disconnected, moveCount
  } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const { toCall, canCheck, canRaise, minTo, maxTo } = options(gameState, playerNumber);
  const lowest = Math.min(minTo, maxTo);
  const [amount, setAmount] = useState(String(lowest));

  useMoveAnimation(screenRef, gameState, animateMove);

  // Each new turn starts the amount at the smallest raise
  useEffect(() => {
    setAmount(String(lowest));
  }, [lowest, moveCount, currentPlayer]);

  const raiseTo = Number(amount);
  const amountOk = Number.isInteger(raiseTo) && raiseTo <= maxTo && (raiseTo >= minTo || raiseTo === maxTo) && raiseTo > currentBet;
  const raiseWord = currentBet === 0 ? 'Bet' : 'Raise to';

  let hint: string | null = null;
  if (isMyTurn) {
    if (!canRaise) hint = canCheck ? 'Check, or fold' : `Call ${chipText(toCall)}, or fold`;
    else if (canCheck) hint = `Check, or bet ${chipText(lowest)} or more`;
    else hint = `Call ${chipText(toCall)}, raise to ${chipText(lowest)} or more, or fold`;
  }

  const holding = (chips[playerNumber] ?? 0) > 0;
  const voted = endVotes.includes(playerNumber);
  const canAct = handResult !== null && !isGameOver && !undoVote && !dismissVote;
  const acknowledged = handResult?.acknowledged.includes(playerNumber) ?? false;
  const holders = activePlayers.filter(seat => (chips[seat] ?? 0) > 0);
  const waitingFor = holders
    .filter(seat => !handResult?.acknowledged.includes(seat) && !disconnected.includes(seat))
    .map(seat => playerNames[seat]);

  return (
    <>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          <div className="hint">{hint}</div>
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.makeMove({ type: 'fold' })} disabled={!isMyTurn}>Fold</button>
            {canCheck || !isMyTurn ? (
              <button type="button" onClick={() => gameService.makeMove({ type: 'check' })} disabled={!isMyTurn || !canCheck}>Check</button>
            ) : (
              <button type="button" onClick={() => gameService.makeMove({ type: 'call' })}>Call {chipText(toCall)}</button>
            )}
            <span className="holdem-raise">
              <input
                type="number"
                aria-label="Amount"
                min={lowest}
                max={maxTo}
                step={1}
                value={isMyTurn && canRaise ? amount : ''}
                disabled={!isMyTurn || !canRaise}
                onChange={event => setAmount(event.target.value)}
              />
              <button
                type="button"
                onClick={() => gameService.makeMove({ type: 'raise', to: raiseTo })}
                disabled={!isMyTurn || !canRaise || !amountOk}
              >
                {raiseWord}
              </button>
              <button
                type="button"
                onClick={() => gameService.makeMove({ type: 'raise', to: maxTo })}
                disabled={!isMyTurn || !canRaise}
              >
                All in
              </button>
            </span>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <HandResultPanel gameState={gameState}>
          {canAct && (
            <div className="holdem-result-actions">
              {holding && (acknowledged
                ? <div className="holdem-waiting">Waiting for {waitingFor.join(', ')}</div>
                : <button type="button" className="primary-button" onClick={() => gameService.sendAction({ type: 'acknowledgeRound' })}>Continue</button>)}
              {holding && (
                <button type="button" onClick={() => gameService.sendAction({ type: 'voteEnd', yes: !voted })}>
                  {voted ? 'Take back my vote to end' : 'Vote to end the game'}
                </button>
              )}
              {endVotes.length > 0 && (
                <div className="holdem-end-votes">
                  Votes to end: {endVotes.map(seat => playerNames[seat]).join(', ')} ({endVotes.length} of {holders.length})
                </div>
              )}
            </div>
          )}
        </HandResultPanel>
        <Table gameState={gameState} viewer={playerNumber} />
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
