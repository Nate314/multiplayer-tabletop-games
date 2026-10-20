import { useEffect, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import RoundSummary from './RoundSummary';
import Table from './Table';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

function turnMessage(state: PublicGameState, isMe: boolean): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver, roundSummary } = state;
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  if (roundSummary) return 'Round over';
  const name = currentPlayer === null ? '' : playerNames[currentPlayer];
  if (!started) return `${name} goes first. Joining closes after the first move.`;
  return isMe ? 'Your turn' : `${name}'s turn`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [finalScoringClosed, setFinalScoringClosed] = useState(false);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, heldFrom, myHeld, roundSummary } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const showSummary = roundSummary !== null && !(isGameOver && finalScoringClosed);

  useEffect(() => {
    // An undo can reopen a finished game; its next ending shows the scoring again
    if (!isGameOver) setFinalScoringClosed(false);
  }, [isGameOver]);

  let hint = '';
  if (isMyTurn && heldFrom === null) hint = 'Take the top card of the draw pile or the discard pile';
  else if (isMyTurn && heldFrom === 'deck') hint = 'Click a slot in your rack to swap the card in, or Discard it';
  else if (isMyTurn) hint = 'Click a slot in your rack to swap the card in';

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-screen">
        <div className="game-info">
          <div className="player-info">You are {gameState.playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turnMessage(gameState, isMyTurn)}</div>
          <div className="hint">{hint}</div>
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
            {isGameOver && roundSummary && finalScoringClosed && (
              <button type="button" onClick={() => setFinalScoringClosed(false)}>Show Scoring</button>
            )}
          </div>
        </div>
        <Table
          gameState={gameState}
          viewer={playerNumber}
          onDraw={isMyTurn && heldFrom === null ? from => gameService.makeMove({ type: 'draw', from }) : undefined}
          onPlace={isMyTurn && myHeld !== null ? slot => gameService.makeMove({ type: 'place', slot }) : undefined}
          onDiscard={isMyTurn ? () => gameService.makeMove({ type: 'discard' }) : undefined}
        />
      </div>
      {showSummary && (
        <RoundSummary
          summary={roundSummary}
          gameState={gameState}
          playerNumber={playerNumber}
          onContinue={() => gameService.sendAction({ type: 'acknowledgeRound' })}
          onClose={() => setFinalScoringClosed(true)}
        />
      )}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
    </>
  );
}
