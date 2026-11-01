import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import AuctionPanel from './AuctionPanel';
import Board from './Board';
import EventLog from './EventLog';
import PlayerList from './PlayerList';
import PropertyPanel from './PropertyPanel';
import TradePanel from './TradePanel';
import TurnPanel from './TurnPanel';
import animateMove from './animateMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

function turnMessage(state: PublicGameState, playerNumber: number): string {
  const { isGameOver, winners, playerNames, activePlayers, started, turnHolder } = state;
  if (isGameOver) return winners.length > 0 ? `Game over: ${playerNames[winners[0]]} wins` : 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  if (turnHolder === null) return '';
  const name = turnHolder === playerNumber ? 'You' : playerNames[turnHolder];
  if (!started) return `${name} ${turnHolder === playerNumber ? 'go' : 'goes'} first. Joining closes after the first move.`;
  return turnHolder === playerNumber ? 'Your turn' : `${name}'s turn`;
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [selected, setSelected] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus } = gameState;
  const noVote = !undoVote && !dismissVote;
  const ready = activePlayers.length >= 2 && !isGameOver && noVote;
  const canMove = ready && currentPlayer === playerNumber;
  const canAct = ready && activePlayers.includes(playerNumber);
  const canUndo = undoAvailable && noVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardRef, gameState, animateMove);

  const select = (space: number) => setSelected(current => current === space ? null : space);

  return (
    <>
      <div className="monopoly-layout">
        <div className="board-area hand-only-board" ref={boardRef}>
          <Board gameState={gameState} selected={selected} onSelect={select} />
        </div>
        <div className="side-panel">
          <div className={error ? 'game-status game-status-error' : 'game-status'} role="status">{error || gameStatus}</div>
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          <TurnPanel key={`${currentPlayer}-${gameState.moveCount}`} gameState={gameState} playerNumber={playerNumber}
            canMove={canMove} onMove={move => gameService.makeMove(move)} />
          <AuctionPanel key={gameState.auction?.space ?? 'none'} gameState={gameState} playerNumber={playerNumber} canAct={canAct}
            onAction={action => gameService.sendAction(action)} />
          {selected !== null && (
            <PropertyPanel gameState={gameState} space={selected} playerNumber={playerNumber} canManage={canMove}
              onMove={move => gameService.makeMove(move)} onClose={() => setSelected(null)} />
          )}
          <TradePanel gameState={gameState} playerNumber={playerNumber} canAct={canAct} onAction={action => gameService.sendAction(action)} />
          <button type="button" className="undo-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          <PlayerList gameState={gameState} viewer={playerNumber} onSelect={select} />
          <EventLog log={gameState.log} />
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
