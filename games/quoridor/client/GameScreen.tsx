import { useState, useEffect, useRef, type CSSProperties } from 'react';
import gameService from '../../../src/services/gameService';
import ActionButtons from './ActionButtons';
import Board from './Board';
import GameStatus from './GameStatus';
import GoalList from './GoalList';
import PieceTray from '../../../src/components/PieceTray';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import { useDrag } from '../../../src/drag/useDrag.ts';
import { nextWallAction, squareMove, squareOf } from './walls.ts';
import animateMove from './animateMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState } from '../types.ts';
import type { Action } from './types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { WALL_URL } from './pieces.ts';
import { DISC_URL } from '../../../src/components/pieces.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [selectedAction, setSelectedAction] = useState<Action>('move');
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const wallsLeft = gameState.wallCounts[playerNumber] ?? 0;
  const wallBlocked = !isMyTurn ? 'Not your turn' : wallsLeft > 0 ? undefined : 'No walls left';
  const wallHeld = isMyTurn && selectedAction !== 'move';
  const beforeLift = useRef<Action>('move');

  // The orientation a lifted wall takes: the one held, or horizontal. Read from the action, not from onLift's re-render.
  const liftedAction = (id: string): Action => id === 'pawn' ? 'move' : selectedAction === 'move' ? nextWallAction('move', 'tap') : selectedAction;
  const dropMove = (id: string, target: string) => squareMove(gameState, playerNumber, liftedAction(id), squareOf(target));

  const drag = useDrag({
    canLift: id => isMyTurn && (id === 'pawn' || (id === 'wall' && !wallBlocked)),
    canDrop: (id, target) => dropMove(id, target) !== null,
    onLift: id => {
      beforeLift.current = selectedAction;
      setSelectedAction(liftedAction(id));
    },
    onDrop: (id, target) => {
      const move = dropMove(id, target);
      if (move) handleMove(move);
    },
    onCancel: () => setSelectedAction(beforeLift.current)
  });

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardAreaRef, gameState, animateMove);

  useEffect(() => {
    // Reset to move at the start of every turn
    setSelectedAction('move');
  }, [currentPlayer]);

  function handleMove(move: Move) {
    gameService.makeMove(move);
    if (move.type === 'wall') setSelectedAction('move');
  }

  // R turns the held wall, unless the player is typing or holding a modifier
  useEffect(() => {
    if (!wallHeld) return;
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'r' || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as Element | null)?.closest?.('input, textarea, select')) return;
      setSelectedAction(action => nextWallAction(action, 'rotate'));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wallHeld]);

  return (
    <>
      <div className="game-id hand-only-hide">Game ID: {gameState.gameId}</div>
      <div className="game game-layout">
        <div className="board-area" ref={boardAreaRef}>
          <Board
            gameState={gameState}
            playerNumber={playerNumber}
            isMyTurn={isMyTurn}
            selectedAction={selectedAction}
            onMove={handleMove}
            drag={drag}
          />
          <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
        </div>
        <div className="game-info side-panel">
          <GameStatus gameState={gameState} error={error} />
          <PieceTray
            label="Your action"
            leading={
              <button type="button" className="piece-tray-piece" aria-pressed={!wallHeld} onClick={() => setSelectedAction('move')}>
                <span className="tray-pawn" style={{ '--disc-fill': `var(--player${playerNumber}, var(--wall))` } as CSSProperties}>
                  <ServerSvg url={DISC_URL} className="piece-art" />
                </span>
                Move
              </button>
            }
            pieces={[{
              id: 'wall',
              label: 'Wall',
              icon: <ServerSvg url={WALL_URL} className={`tray-wall ${selectedAction === 'wall-v' ? 'vertical' : 'horizontal'}`} />,
              count: wallsLeft,
              blocked: wallBlocked
            }]}
            selected={wallHeld ? 'wall' : null}
            onTap={() => setSelectedAction(action => nextWallAction(action, 'tap'))}
            drag={drag}
          />
          <ActionButtons
            gameState={gameState}
            playerNumber={playerNumber}
            onUndo={() => gameService.requestUndo()}
          />
          <GoalList gameState={gameState} playerNumber={playerNumber} />
        </div>
      </div>
    </>
  );
}
