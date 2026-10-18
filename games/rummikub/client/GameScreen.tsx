import { useCallback, useRef } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import PlayArea from './PlayArea';
import Players from './Players';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import { animateMove } from './animateMove.ts';
import { rackOrder } from './draft.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState, Seat } from '../types.ts';

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver } = state;
  const currentName = currentPlayer === null ? '' : playerNames[currentPlayer];
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  if (!started) return `${currentName} goes first. Joining closes after the first move.`;
  return currentPlayer === playerNumber ? 'Your turn' : `${currentName}'s turn`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, moveCount, rack, gameStatus } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const layoutRef = useRef<HTMLDivElement>(null);

  // The rack order the player last arranged, kept across moves so a sort or rearrangement stays put
  const orderRef = useRef<number[]>([]);
  const onRackOrder = useCallback((order: number[]) => { orderRef.current = order; }, []);
  const initialRack = rackOrder(rack, orderRef.current);

  useMoveAnimation(layoutRef, gameState, animateMove);

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="rk-layout" ref={layoutRef}>
        <div className="rk-side-panel">
          <div className="rk-player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'rk-status rk-status-error' : 'rk-status'}>{error || gameStatus}</div>
          )}
          <div className="rk-turn-message">{turnMessage(gameState, playerNumber)}</div>
          <Players gameState={gameState} playerNumber={playerNumber} />
          <div className="rk-action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <PlayArea
          key={`${moveCount}:${rack.join(',')}`}
          gameState={gameState}
          playerNumber={playerNumber}
          isMyTurn={isMyTurn}
          initialRack={initialRack}
          onRackOrder={onRackOrder}
        />
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
