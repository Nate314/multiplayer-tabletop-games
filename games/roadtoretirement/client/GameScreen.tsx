import { useRef } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import CheckeredBoard from './CheckeredBoard';
import ChoicePanel from './ChoicePanel';
import PlayerList from './PlayerList';
import RoadBoard from './RoadBoard';
import Spinner from './Spinner';
import animateMove from './animateMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState } from '../types.ts';

function turnMessage(state: PublicGameState, playerNumber: number): string {
  const { isGameOver, playerNames, activePlayers, started, currentPlayer, checkered } = state;
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  if (currentPlayer === null) return '';
  const mine = currentPlayer === playerNumber;
  if (!started) return `${mine ? 'You go' : `${playerNames[currentPlayer]} goes`} first. Joining closes after the first move.`;
  if (mine && checkered?.phase === 'choose') return 'Your turn: pick a highlighted square';
  return mine ? 'Your turn' : `${playerNames[currentPlayer]}'s turn`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const boardRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, board, road, checkered } = gameState;
  const noVote = !undoVote && !dismissVote;
  const canMove = activePlayers.length >= 2 && !isGameOver && noVote && currentPlayer === playerNumber;
  const canSpin = canMove && (board === 'checkered' ? checkered?.phase : road?.phase) === 'spin';
  const canUndo = undoAvailable && noVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const move = (m: Move) => gameService.makeMove(m);

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardRef, gameState, animateMove);

  return (
    <>
      <div className="rtr-layout">
        <div className={`board-area board-${board}`} ref={boardRef}>
          {board === 'checkered'
            ? <CheckeredBoard gameState={gameState} canMove={canMove} onMove={move} highlight={null} />
            : <RoadBoard gameState={gameState} highlight={null} />}
        </div>
        <div className="side-panel">
          <div className={error ? 'game-status game-status-error' : 'game-status'} role="status">{error || gameStatus}</div>
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          <Spinner gameState={gameState} canSpin={canSpin} onSpin={() => move({ type: 'spin' })} />
          {canMove && board === 'road' && <ChoicePanel gameState={gameState} playerNumber={playerNumber} onMove={move} />}
          <button type="button" className="undo-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          <PlayerList gameState={gameState} viewer={playerNumber} />
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
